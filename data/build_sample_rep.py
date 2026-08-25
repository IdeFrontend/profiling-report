#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate `data/sample.rep`: a nested multi-operator `npu-rep` container with
two *distinct* operators (leaves `data/example.npu.rep` untouched).

Layout (little-endian), matches `src/adapters/parseNpuRep.ts`:

  Head (36 bytes): magic[8]="npu-rep\\0", version:u32=0x00010000, orgin:u16,
                   repHeadLength:u16=36, fileInfoCount:u32, fileInflLength:u32=164,
                   resv:u32, npuRepLength:u64
  FileInfo (164 bytes): magic[8]="npu-rep\\0", name[128], type:u32, resv:u32,
                        pad:u32, length:u64, offset:u64

  type 6 = nested operator archive (.npu.rep); type 1 = csv; type 2 = json/jsonl.

Operators:
  op1 — small "machine view" trace (async s/f flow connections) + baseline
        `add_custom` CSVs reused verbatim from `data/out.rep`.
  op2 — big "stress medium" trace (Card -> core -> pipe lanes, async flow
        connections) + transformed CSVs (different op name, block range and
        scaled metric values).

Both keep the full 11-leaf payload set so the right sidebar stays available.
"""

import json
import os
import struct

MAGIC = b"npu-rep\x00"
VERSION = 0x00010000
HEAD_SIZE = 36
FILEINFO_SIZE = 164

TYPE_CSV = 1
TYPE_JSON = 2
TYPE_NESTED = 6

# Stress "medium" preset lane shape (generateStressSwimlane: 2 cards x 3 cores x 9 pipes).
STRESS_PIPES = ["ALL", "SCALAR", "FLOWCTRL", "MTE1", "CUBE", "FIXP", "MTE2", "MTE3", "CACHEMISS"]
STRESS_CORES = ["core0.cube", "core0.vec0", "core0.vec1"]
# Pipeline chain used to wire cross-pipe connections (MTE1 -> CUBE -> ... -> CACHEMISS).
PIPELINE_ORDER = ["MTE1", "CUBE", "MTE2", "MTE3", "SCALAR", "FLOWCTRL", "FIXP", "ALL", "CACHEMISS"]


def pack_npu_rep(entries):
    """entries: list of (name: str, type: int, data: bytes). Returns bytes."""
    n = len(entries)
    data_start = HEAD_SIZE + n * FILEINFO_SIZE
    layout = []
    cur = data_start
    for name, typ, data in entries:
        layout.append((name, typ, data, cur, len(data)))
        cur += len(data)
    total = cur

    head = struct.pack(
        "<8sIHHIIIQ",
        MAGIC, VERSION, 0, HEAD_SIZE, n, FILEINFO_SIZE, 0, total,
    )
    assert len(head) == HEAD_SIZE, f"head size {len(head)} != {HEAD_SIZE}"

    info_blocks = []
    for name, typ, data, offset, length in layout:
        name_bytes = os.path.basename(name).encode("utf-8")
        if len(name_bytes) >= 128:
            name_bytes = name_bytes[:127] + b"\x00"
        else:
            name_bytes = name_bytes.ljust(128, b"\x00")
        info = struct.pack(
            "<8s128sIIIQQ",
            MAGIC, name_bytes, typ, 0, 0, length, offset,
        )
        assert len(info) == FILEINFO_SIZE, f"fileinfo size {len(info)} != {FILEINFO_SIZE}"
        info_blocks.append(info)

    out = bytearray()
    out += head
    for b in info_blocks:
        out += b
    for name, typ, data, offset, length in layout:
        out += data
    return bytes(out)


# ---------------------------------------------------------------- trace gen

def _m_process(pid, name):
    return {"ph": "M", "name": "process_name", "pid": pid, "tid": 0, "args": {"name": name}}


def _m_thread(pid, tid, name):
    return {"ph": "M", "name": "thread_name", "pid": pid, "tid": tid, "args": {"name": name}}


def _x(pid, tid, name, ts, dur):
    return {"ph": "X", "pid": pid, "tid": tid, "name": name, "ts": ts, "dur": dur}


def _flow(ph, pid, tid, flow_id, ts):
    return {"ph": ph, "pid": pid, "tid": tid, "id": flow_id, "ts": ts, "name": "flow"}


def _doc(events):
    return {"displayTimeUnit": "ns", "traceEvents": events}


def small_trace():
    """Machine-view style: a few lanes + async s/f flows across them (connections)."""
    evs = [_m_process(1, "Machine View")]
    lanes = [
        (1000, "comm"),
        (1002, "core0.cube"),
        (1004, "core0.vec"),
        (1006, "core1.cube"),
    ]
    for tid, name in lanes:
        evs.append(_m_thread(1, tid, name))

    n = 10
    period = 10_000
    dur = 6_000
    for tid, _name in lanes:
        for i in range(n):
            evs.append(_x(1, tid, f"task_{tid}_{i}", i * period, dur))

    flow_id = 0
    for i in range(n):
        mid = i * period + dur // 2
        for k in range(len(lanes) - 1):
            evs.append(_flow("s", 1, lanes[k][0], flow_id, mid))
            evs.append(_flow("f", 1, lanes[k + 1][0], flow_id, mid))
            flow_id += 1
    return _doc(evs)


def big_trace():
    """Stress-medium style: 2 cards x 3 cores x 9 pipes, async flows across pipes."""
    evs = []
    lanes = []  # (pid, tid, core, pipe)
    events_per_lane = 60
    period = 20_000
    dur = 13_000

    for card in range(2):
        pid = card + 1
        evs.append(_m_process(pid, f"Card{card}"))
        tid = 1000 + card * 100
        for core in STRESS_CORES:
            for pipe in STRESS_PIPES:
                evs.append(_m_thread(pid, tid, f"{core}/{pipe}"))
                lanes.append((pid, tid, core, pipe))
                for i in range(events_per_lane):
                    evs.append(_x(pid, tid, f"{pipe}_{i}", i * period, dur))
                tid += 1

    tid_of = {(pid, core, pipe): tid for pid, tid, core, pipe in lanes}

    flow_id = 0
    step = 8
    for card in range(2):
        pid = card + 1
        for core in STRESS_CORES:
            for i in range(0, events_per_lane, step):
                mid = i * period + dur // 2
                for k in range(len(PIPELINE_ORDER) - 1):
                    up = tid_of[(pid, core, PIPELINE_ORDER[k])]
                    dn = tid_of[(pid, core, PIPELINE_ORDER[k + 1])]
                    evs.append(_flow("s", pid, up, flow_id, mid))
                    evs.append(_flow("f", pid, dn, flow_id, mid))
                    flow_id += 1
    return _doc(evs)


# ------------------------------------------------------------------ CSV gen

def read_out_rep(path):
    """Parse the flat `cann-rep` container (36-byte head + 160-byte fileinfo)."""
    buf = open(path, "rb").read()
    _magic, _version, count, _file_length, _rep_length, _data_start = struct.unpack_from(
        "<8sIIIQQ", buf, 0
    )
    payloads = {}
    for i in range(count):
        pos = 36 + i * 160
        _fmagic, name_b, _typ, _origin, _resv, length, offset = struct.unpack_from(
            "<8s128sHHIQQ", buf, pos
        )
        name = name_b.split(b"\x00", 1)[0].decode("utf-8", "replace")
        payloads[name] = buf[offset:offset + length]
    return payloads


def _fmt(v):
    s = f"{v:.6f}".rstrip("0").rstrip(".")
    return s if s not in ("", "-0") else "0"


def transform_metric_csv(text, scale, block_offset, sub_label, n_rows):
    """Rewrite a block_id/sub_block_id CSV with a new block range + scaled values."""
    lines = text.rstrip("\n").split("\n")
    header = lines[0]
    data = lines[1:]
    out = [header]
    for i in range(n_rows):
        cells = data[i % len(data)].split(",")
        if len(cells) >= 2:
            cells[0] = str(block_offset + i)
            cells[1] = sub_label
        for j in range(2, len(cells)):
            c = cells[j].strip()
            if c == "NA" or c == "":
                continue
            try:
                cells[j] = _fmt(float(c) * scale)
            except ValueError:
                pass
        out.append(",".join(cells))
    return "\n".join(out) + "\n"


def transform_op_basic_info(text):
    """Swap the single OpBasicInfo row for a different operator identity."""
    header = text.split("\n", 1)[0]
    row = "matmul_mock,mix,3.502000,16,8,0,3073000,1500,1500,"
    return header + "\n" + row + "\n"


def hardware_info(chip_info, ai_core_count, ai_vector_count):
    lines = [
        {"category": "Host Info", "cpu_physical_count": 2, "cpu_logical_count": 46,
         "memory_total_size_MB": 461897260, "disk_total_size_GB": 2879978960},
        {"category": "Device Info", "npu_count": 1, "chip_info": chip_info, "arch_info": "3510"},
        {"category": "CPU Information", "control_cpu_count": 1, "ai_cpu_count": 6,
         "ai_cpu_frequency_MHZ": 1500},
        {"category": "AI Core Information", "ai_core_count": ai_core_count,
         "ai_cube_count": ai_core_count, "ai_vector_count": ai_vector_count,
         "ai_core_frequency_MHZ": [100, 100]},
        {"category": "Memory Information", "hbm_total_MB": 131072,
         "hbm_used_MB": 5190.55, "hbm_frequency_MHZ": 3200},
    ]
    return "\n".join(json.dumps(x) for x in lines) + "\n"


# -------------------------------------------------------------------- build

METRIC_SCALES = {
    "PipeUtilization.csv": 1.6,
    "ArithmeticUtilization.csv": 1.4,
    "Memory.csv": 1.2,
    "MemoryL0.csv": 1.3,
    "MemoryUB.csv": 1.5,
    "L2Cache.csv": 0.6,
    "ResourceConflictRatio.csv": 1.8,
}


def leaf_entries(out_rep, trace, *, transform, sub_label, chip_info,
                 ai_core_count, ai_vector_count, block_offset, n_rows):
    payloads = []
    for name, data in out_rep.items():
        if name == "trace.json":
            payloads.append(("trace.json", TYPE_JSON, trace))
        elif name == "OpBasicInfo.csv":
            text = data.decode("utf-8")
            payloads.append(("OpBasicInfo.csv", TYPE_CSV,
                             (transform_op_basic_info(text) if transform else text).encode("utf-8")))
        elif name in METRIC_SCALES:
            text = data.decode("utf-8")
            if transform:
                text = transform_metric_csv(
                    text, METRIC_SCALES[name], block_offset, sub_label, n_rows
                )
            payloads.append((name, TYPE_CSV, text.encode("utf-8")))
        else:
            payloads.append((name, TYPE_CSV, data))

    payloads.append(("HardwareInfo.jsonl", TYPE_JSON,
                     hardware_info(chip_info, ai_core_count, ai_vector_count).encode("utf-8")))
    payloads.append(("statistical_utilization.json", TYPE_JSON,
                     json.dumps({"operator": sub_label}).encode("utf-8")))

    payloads.sort(key=lambda p: p[0])
    return payloads


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    out_rep = read_out_rep(os.path.join(here, "out.rep"))

    op1 = leaf_entries(
        out_rep,
        trace=json.dumps(small_trace(), separators=(",", ":")).encode("utf-8"),
        transform=False,
        sub_label="vector0",
        chip_info="Ascend 950PR_9599 V100",
        ai_core_count=36,
        ai_vector_count=72,
        block_offset=0,
        n_rows=8,
    )
    op2 = leaf_entries(
        out_rep,
        trace=json.dumps(big_trace(), separators=(",", ":")).encode("utf-8"),
        transform=True,
        sub_label="vector1",
        chip_info="Ascend 910B",
        ai_core_count=24,
        ai_vector_count=48,
        block_offset=100,
        n_rows=12,
    )

    op1_bytes = pack_npu_rep(op1)
    op2_bytes = pack_npu_rep(op2)
    container = pack_npu_rep([
        ("op1.npu.rep", TYPE_NESTED, op1_bytes),
        ("op2.npu.rep", TYPE_NESTED, op2_bytes),
    ])

    out_path = os.path.join(here, "sample.rep")
    with open(out_path, "wb") as fp:
        fp.write(container)

    print(f"[OK] wrote {out_path} ({len(container)} bytes)")
    print(f"     op1 leaf: {len(op1_bytes)} bytes, {len(op1)} files")
    print(f"     op2 leaf: {len(op2_bytes)} bytes, {len(op2)} files")


if __name__ == "__main__":
    main()
