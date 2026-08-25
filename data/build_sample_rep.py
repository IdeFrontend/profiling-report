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
  op1 — small machine-view style: sparse irregular ops (matmul/cast/mov) with
        `args.event_id` + `args.dependencies` connections + baseline
        `add_custom` CSVs reused verbatim from `data/out.rep`.
  op2 — denser pipe-busy style: Card/core/pipe lanes with bursty occupancy,
        variable durations, idle gaps, and cross-pipe dependency chains +
        transformed CSVs (different op name, block range, scaled metrics).

Both keep the full 11-leaf payload set so the right sidebar stays available.
Traces deliberately avoid uniform grids — timings mimic real Ascend pipe-state /
machine-view samples (`out.trace.json`, `ffn_dense.trace.json`).
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

STRESS_PIPES = ["ALL", "SCALAR", "FLOWCTRL", "MTE1", "CUBE", "FIXP", "MTE2", "MTE3", "CACHEMISS"]
STRESS_CORES = ["Core0.Cube", "Core0.Vec0", "Core0.Vec1"]
# Typical Ascend data-path chain used for cross-pipe dependencies.
PIPELINE_ORDER = ["MTE2", "MTE1", "CUBE", "FIXP", "MTE3"]

# Per-pipe occupancy / duration profile (busy fraction of the timeline).
PIPE_PROFILE = {
    "ALL":       {"occupancy": 0.15, "avg_busy": 800,  "avg_gap": 4000, "names": ["ALL_busy"]},
    "SCALAR":    {"occupancy": 0.25, "avg_busy": 400,  "avg_gap": 1200, "names": ["SCALAR_busy"]},
    "FLOWCTRL":  {"occupancy": 0.08, "avg_busy": 200,  "avg_gap": 6000, "names": ["FLOWCTRL_busy"]},
    "MTE1":      {"occupancy": 0.45, "avg_busy": 2200, "avg_gap": 1800, "names": ["MOV_IN_L1", "MTE1_busy"]},
    "CUBE":      {"occupancy": 0.55, "avg_busy": 3500, "avg_gap": 1500, "names": ["matmul", "CUBE_busy"]},
    "FIXP":      {"occupancy": 0.30, "avg_busy": 900,  "avg_gap": 2200, "names": ["FIX_LOC_TO_DST", "FIXP_busy"]},
    "MTE2":      {"occupancy": 0.70, "avg_busy": 5000, "avg_gap": 800,  "names": ["MOV_OUT_TO_L1", "MTE2_busy"]},
    "MTE3":      {"occupancy": 0.40, "avg_busy": 1800, "avg_gap": 2000, "names": ["MOV_OUT", "MTE3_busy"]},
    "CACHEMISS": {"occupancy": 0.12, "avg_busy": 60,   "avg_gap": 3500, "names": ["CACHEMISS"]},
}


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


# ---------------------------------------------------------------- PRNG / helpers

def mulberry32(seed):
    """Deterministic PRNG (same family as generateStressSwimlane)."""
    a = seed & 0xFFFFFFFF

    def rand():
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = a
        t = (t ^ (t >> 15)) * (t | 1) & 0xFFFFFFFF
        t ^= (t + ((t ^ (t >> 7)) * (t | 61) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296.0

    return rand


def _m_process(pid, name):
    return {"ph": "M", "name": "process_name", "pid": pid, "tid": 0, "args": {"name": name}}


def _m_thread(pid, tid, name):
    return {"ph": "M", "name": "thread_name", "pid": pid, "tid": tid, "args": {"name": name}}


def _x(pid, tid, name, ts, dur, event_id=None, deps=None, extra=None):
    args = {}
    if event_id is not None:
        args["event_id"] = event_id
    if deps:
        args["dependencies"] = deps
    if extra:
        args.update(extra)
    ev = {"ph": "X", "pid": pid, "tid": tid, "name": name, "ts": int(ts), "dur": int(dur)}
    if args:
        ev["args"] = args
    return ev


def _doc(events):
    return {"displayTimeUnit": "ns", "traceEvents": events}


def _pick_name(names, rand):
    if len(names) == 1:
        return names[0]
    # Prefer the first (concrete op) name ~70% of the time.
    return names[0] if rand() < 0.7 else names[1]


def emit_bursty_lane(pid, tid, pipe, time_span, rand, id_prefix, seq_start=0):
    """
    Emit irregular busy intervals for one pipe lane.
    Mixes short markers, medium bursts, and occasional long transfers —
    same silhouette as out.trace.json (PIPE_*_busy + markers).
    """
    profile = PIPE_PROFILE[pipe]
    events = []  # (event_id, start, end, event_dict)
    t = int(rand() * profile["avg_gap"] * 0.4)  # staggered lane start
    i = seq_start
    while t < time_span:
        # Burst phase: 1–4 clustered events, then a longer idle.
        burst = 1 + int(rand() * 3.5)
        for _ in range(burst):
            if t >= time_span:
                break
            # Duration: log-ish skew — mostly short, occasional long.
            scale = rand() * rand()
            dur = max(1, int(profile["avg_busy"] * (0.15 + 2.4 * scale)))
            # Sparse marker sprinkles on SCALAR / CACHEMISS.
            is_marker = pipe in ("SCALAR", "CACHEMISS") and rand() < 0.35
            if is_marker:
                dur = 1
                name = f"marker_{i}"
            else:
                name = _pick_name(profile["names"], rand)
            if t + dur > time_span:
                dur = max(1, time_span - t)
            eid = f"{id_prefix}-{pipe}-{i}"
            ev = _x(pid, tid, name, t, dur, event_id=eid)
            events.append((eid, t, t + dur, ev))
            t += dur
            # Micro-gap inside a burst.
            t += max(0, int(profile["avg_gap"] * 0.05 * (0.2 + rand())))
            i += 1
        # Idle gap between bursts — heavy skew so lanes don't line up.
        gap = int(profile["avg_gap"] * (0.4 + 2.5 * rand() * rand()))
        t += gap
    return events


def wire_pipeline_deps(lane_events, rand):
    """
    For each core's PIPELINE_ORDER chain, link a later event on pipe[k+1]
    as a successor of an earlier-finished event on pipe[k] (when timing allows).
    Mutates the event dicts in place via args.dependencies.
    """
    # lane_events: {pipe: [(eid, start, end, ev), ...]} sorted by start
    for k in range(len(PIPELINE_ORDER) - 1):
        up = PIPELINE_ORDER[k]
        dn = PIPELINE_ORDER[k + 1]
        if up not in lane_events or dn not in lane_events:
            continue
        ups = lane_events[up]
        dns = lane_events[dn]
        di = 0
        for eid, _start, end, ev in ups:
            # Skip markers / very short events as dependency sources.
            if end - _start <= 1:
                continue
            if rand() > 0.55:
                continue
            while di < len(dns) and dns[di][1] < end:
                di += 1
            if di >= len(dns):
                break
            # Prefer the first successor that starts after we finish.
            succ_eid = dns[di][0]
            args = ev.setdefault("args", {})
            deps = args.setdefault("dependencies", [])
            if succ_eid not in deps:
                deps.append(succ_eid)


def small_trace():
    """
    Sparse machine-view style (like ffn_dense / depsFixture): a handful of
    named ops with irregular durations and a short dependency chain.
    """
    rand = mulberry32(0xA11CE)
    evs = [_m_process(1, "Card0")]
    lanes = [
        (1, "Core0.Cube/SCALAR"),
        (2, "Core0.Cube/MTE2"),
        (3, "Core0.Cube/CUBE"),
        (4, "Core0.Vec0/ALL"),
        (5, "Core0.Vec0/MTE3"),
    ]
    for tid, name in lanes:
        evs.append(_m_thread(1, tid, name))

    # Hand-authored irregular ops — times in ns, deliberately non-grid.
    # Format: (tid, name, ts, dur, event_id, deps)
    ops = [
        (1, "ProfilerStep#1",            0,     1_200, "step-1",   ["mov-in"]),
        (1, "ProfilerStep#2",            1_800,   640, "step-2",   ["mov-in"]),
        (2, "MOV_OUT_TO_L1_MULTI_ND2NZ", 2_100, 2_740, "mov-in",   ["matmul-0"]),
        (2, "MOV_OUT_TO_L1_MULTI_ND2NZ", 5_900, 1_120, "mov-in-2", ["matmul-1"]),
        (3, "matmul",                    4_950, 3_860, "matmul-0", ["fix-0", "cast-0"]),
        (3, "matmul",                    9_400, 2_210, "matmul-1", ["fix-1"]),
        (3, "CUBE_busy",                12_800,   480, "cube-gap", None),
        (5, "FIX_LOC_TO_DST",            8_900,   740, "fix-0",    ["step-17"]),
        (5, "MOV_OUT",                  11_700, 1_540, "fix-1",    ["step-18"]),
        (4, "cast",                      9_800,   620, "cast-0",   ["step-17"]),
        (4, "ProfilerStep#17",          12_100, 1_900, "step-17",  None),
        (4, "ProfilerStep#18",          14_800, 1_100, "step-18",  None),
        # Sparse markers on SCALAR — clustered, not periodic.
        (1, "marker_3",                  7_240,     1, "m3",       None),
        (1, "marker_7",                  7_290,     1, "m7",       None),
        (1, "marker_9",                  7_410,     1, "m9",       None),
        (1, "marker_12",                10_050,     1, "m12",      None),
    ]
    for tid, name, ts, dur, eid, deps in ops:
        # Jitter durations slightly so they aren't round numbers.
        jitter = int((rand() - 0.5) * dur * 0.08)
        d = max(1, dur + jitter)
        evs.append(_x(1, tid, name, ts, d, event_id=eid, deps=deps or None))
    return _doc(evs)


def big_trace():
    """
    Denser Card → Core → pipe lanes with bursty occupancy. Each pipe has its
    own occupancy / duration profile; events cluster into bursts with idle
    gaps, so the swimlane does not look like a uniform grid.
    """
    rand = mulberry32(0xBEEF01)
    # ~0.08 ms window — enough for irregular bursts without packing every lane solid.
    time_span = 80_000
    evs = []
    # Collect per-(pid,core) pipe events for dependency wiring.
    core_lanes = {}  # (pid, core) -> {pipe: [(eid, start, end, ev), ...]}

    for card in range(2):
        pid = card + 1
        evs.append(_m_process(pid, f"Card{card}"))
        tid = 1000 + card * 100
        for core in STRESS_CORES:
            pipe_map = {}
            for pipe in STRESS_PIPES:
                evs.append(_m_thread(pid, tid, f"{core}/{pipe}"))
                # Per-lane seed so neighbouring pipes don't sync up.
                lane_seed = (pid * 10_000 + tid * 17 + sum(ord(c) for c in pipe)) & 0xFFFFFFFF
                lane_rand = mulberry32(lane_seed)
                # Slightly different time spans per card so Card1 doesn't mirror Card0.
                span = time_span if card == 0 else int(time_span * 0.85)
                emitted = emit_bursty_lane(
                    pid, tid, pipe, span, lane_rand,
                    id_prefix=f"c{card}-{core}",
                )
                pipe_map[pipe] = emitted
                for _eid, _s, _e, ev in emitted:
                    evs.append(ev)
                tid += 1
            core_lanes[(pid, core)] = pipe_map

    for pipe_map in core_lanes.values():
        wire_pipeline_deps(pipe_map, rand)

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
