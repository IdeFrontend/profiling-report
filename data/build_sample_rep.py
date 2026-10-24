#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate `data/sample.lite.rep`: a nested multi-operator product `npu-rep`
(160-byte FileInfo, origin=1) with two *distinct* operators.

op2 omits trace.json (~30 MB); playground/tests hydrate via generateSampleOp2Trace().
Not standalone-valid — hydrate before loadReportSource.

Layout (little-endian), matches `src/adapters/parseNpuRep160.ts` /
`data/scripts/pack_rep.py`:

  Head (36 bytes): magic[8]="npu-rep\\0", version:u32=0x00010000, origin:u16=1,
                   repHeadLength:u16=36, fileInfoCount:u32, fileInfoLength:u32=160,
                   reserved:u32=0, npuRepLength:u64
  FileInfo (160 bytes): magic[8], name[128], type:u16, reserved:u16=0,
                        reserved1:u32=0, length:u64, offset:u64

  type 1 = nested operator archive; 2 = json; 3 = jsonl; 4 = csv; 5 = sqlite3; 7 = txt.

Both operators embed a four-file Ascend C Source pack (objdump + symbolizer + summary.db),
a HardwareInfo Roofline category, and UbRwAccesses rows. op1 Code frames point at those files.
summary.db is pc_sampling; Sampling Stall on Source / SASS comes from those counters.

Operators:
  op1 — machine-view style (~100 X events) + product Summary.jsonl / Sampling.json
        + demo-worthy FLOPS/BW/parallel util. Intentionally plants call-stack nests
        across SCALAR (depth 3), MTE2 and ALL (depth 2) so multi-height lanes are
        visible; CUBE / FIXP / MTE1 / MTE3 stay exclusive.
  op2 — CSVs/Summary/Sampling only; ~150k-event stress trace injected at hydrate.
        Exclusive leaf spans (no multi-height).
"""

import json
import math
import os
import struct

MAGIC = b"npu-rep\x00"
VERSION = 0x00010000
ORIGIN = 1
HEAD_SIZE = 36
FILEINFO_SIZE = 160

TYPE_NESTED = 1
TYPE_JSON = 2
TYPE_JSONL = 3
TYPE_CSV = 4
TYPE_SQLITE = 5
TYPE_TXT = 7

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
    """entries: list of (name: str, type: int, data: bytes). Returns product 160-byte npu-rep."""
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
        MAGIC, VERSION, ORIGIN, HEAD_SIZE, n, FILEINFO_SIZE, 0, total,
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
            "<8s128sHHIQQ",
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


# Sketch Parameter column fields (event-details §11.2.8.1). op2 omits Code
# paths so the ~150k-event fixture stays near ~30 MB.
# Paths match the embedded Source files (basename). A missing line opens line 1.
# `None` line → bare path. Every 5th event also carries a Line:0 object frame
# on the fixp path (index 2). Every 7th event adds a path that is not in the pack.
# Line numbers are filled in after the kernel texts (`_bind_source_frames`).
CUBE_SRC_PATH = "/opt/ascend/tikcpp/impl/cube_op.cpp"
MTE_SRC_PATH = "/home/ops/kernels/mte_copy.cpp"
FIXP_SRC_PATH = "/home/ops/kernels/fixp_loc.cpp"
TILE_SRC_PATH = "/opt/ascend/tikcpp/lib/matmul/b.h"
SOURCE_FRAMES = [
    (CUBE_SRC_PATH, None),
    (MTE_SRC_PATH, None),
    (FIXP_SRC_PATH, None),
    (TILE_SRC_PATH, None),
]
UNMATCHED_CODE = "/tmp/not-bundled.cpp"


def producer_params(pipe, name, rand, seq, dur, *, rich=True):
    """Synthetic producer args for DetailParameter (not DATA-36a transport).

    `rich=True` (op1): includes Code paths for the Parameter column.
    `rich=False` (op2): compact fields only — keeps the large fixture near ~30 MB.
    """
    pc = 0xF0010000 + ((seq * 0x20) & 0xFFFF) + (sum(ord(c) for c in pipe) & 0xFF)
    nbytes = max(16, int(dur) if dur > 1 else 16 + int(rand() * 480))
    lo = int(rand() * 200)
    hi = lo + max(8, int(rand() * 128))
    detail_by_pipe = {
        "SCALAR": f"S[{lo}:{hi}]",
        "FLOWCTRL": f"FC[{lo}]",
        "MTE1": f"L1[{lo}:{hi}]",
        "MTE2": f"GM>L1[{lo}:{hi}]",
        "MTE3": f"UB>GM[{lo}:{hi}]",
        "CUBE": f"L0[{lo}:{hi}]",
        "FIXP": f"FIX[{lo}:{hi}]",
        "ALL": f"ALL[{lo}:{hi}]",
        "CACHEMISS": f"I$@{pc:x}",
    }
    out = {
        "op_type": pipe if name.startswith("marker_") else name,
        "Pc_addr": f"0x{pc:08x}",
        "Process_bytes": nbytes,
        "Detail": detail_by_pipe.get(pipe, f"{pipe}[{lo}:{hi}]"),
    }
    if rich:
        path, line = SOURCE_FRAMES[int(rand() * len(SOURCE_FRAMES))]
        code = [f"{path}:{line}" if line else path]
        if rand() < 0.35:
            path2, line2 = SOURCE_FRAMES[int(rand() * len(SOURCE_FRAMES))]
            second = f"{path2}:{line2}" if line2 else path2
            if second not in code:
                code.append(second)
        if seq % 5 == 0:
            code.append({"FileName": SOURCE_FRAMES[2][0], "Line": 0})
        if seq % 7 == 0:
            code.append(UNMATCHED_CODE)
        out["Code"] = code
    return out


def profiler_step_bands(count, time_span):
    """Contiguous ProfilerStep slabs covering [0, time_span) — same as stress presets."""
    if count <= 0 or time_span <= 0:
        return []
    step = time_span // count
    bands = []
    for i in range(count):
        start = i * step
        end = time_span if i == count - 1 else (i + 1) * step
        bands.append({
            "id": f"band-step-{i + 1}",
            "name": f"ProfilerStep#{i + 1}",
            "ts": int(start),
            "dur": int(max(1, end - start)),
        })
    return bands


def _doc(events, band_count=0, time_span=0, nest_card_tree=False):
    doc = {"displayTimeUnit": "ns", "traceEvents": events}
    # Opt-in Card→计算→Core→pipe nesting in adaptRep (not applied to every .rep).
    if nest_card_tree:
        doc["nestCardTree"] = True
    bands = profiler_step_bands(band_count, time_span)
    if bands:
        doc["bands"] = bands
    return doc


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
            ev = _x(
                pid, tid, name, t, dur, event_id=eid,
                extra=producer_params(pipe, name, rand, i, dur),
            )
            events.append((eid, t, t + dur, ev))
            t += dur
            # Micro-gap inside a burst.
            t += max(0, int(profile["avg_gap"] * 0.05 * (0.2 + rand())))
            i += 1
        # Idle gap between bursts — heavy skew so lanes don't line up.
        gap = int(profile["avg_gap"] * (0.4 + 2.5 * rand() * rand()))
        t += gap
    return events


def wire_dense_deps(lane_events, rand, min_deg=1, max_deg=5):
    """
    Give every event min_deg–max_deg undirected dependency neighbors.
    Prefers cross-pipe successor links whose start is after the source ends.
    Final pass force-links orphans so none stay at degree 0.
    Mutates event dicts in place via args.dependencies.
    """
    flat = []  # (eid, start, end, ev, pipe)
    for pipe, items in lane_events.items():
        for eid, start, end, ev in items:
            flat.append((eid, start, end, ev, pipe))
    flat.sort(key=lambda x: (x[1], x[2], x[0]))

    neighbors = {eid: set() for eid, *_ in flat}
    ev_by_id = {eid: ev for eid, _s, _e, ev, _p in flat}

    def add_edge(src_eid, dst_eid, *, force=False):
        if src_eid == dst_eid:
            return False
        if not force and (len(neighbors[src_eid]) >= max_deg or len(neighbors[dst_eid]) >= max_deg):
            return False
        # Even when forcing min_deg, keep a soft ceiling so one hub cannot absorb all edges.
        hard = max_deg + 2
        if force and (len(neighbors[src_eid]) >= hard or len(neighbors[dst_eid]) >= hard):
            return False
        src_ev = ev_by_id[src_eid]
        deps = src_ev.setdefault("args", {}).setdefault("dependencies", [])
        if dst_eid in deps:
            return False
        deps.append(dst_eid)
        neighbors[src_eid].add(dst_eid)
        neighbors[dst_eid].add(src_eid)
        return True

    for i, (eid, _start, end, _ev, pipe) in enumerate(flat):
        # Bias toward denser graphs: pick in the upper half of [min_deg, max_deg].
        span = max_deg - min_deg + 1
        target = min_deg + (span // 2) + int(rand() * ((span + 1) // 2))
        target = max(min_deg, min(max_deg, target))
        cands = [
            (j, flat[j][0], flat[j][4])
            for j in range(i + 1, len(flat))
            if flat[j][1] >= end and len(neighbors[flat[j][0]]) < max_deg
        ]
        cross = [c for c in cands if c[2] != pipe]
        pool = list(cross if len(cross) >= min_deg else cands)
        need = target - len(neighbors[eid])
        while need > 0 and pool and len(neighbors[eid]) < max_deg:
            window = min(12, len(pool))
            pick = int(rand() * window)
            _j, dst, _p = pool.pop(pick)
            if add_edge(eid, dst):
                need -= 1

    # Top-up every event to min_deg (force past soft max if needed).
    for i, (eid, start, end, _ev, _pipe) in enumerate(flat):
        attempts = 0
        while len(neighbors[eid]) < min_deg and attempts < 64:
            attempts += 1
            later = [
                flat[j][0]
                for j in range(i + 1, len(flat))
                if flat[j][0] not in neighbors[eid] and flat[j][1] >= end
            ]
            if later:
                if add_edge(eid, later[int(rand() * min(8, len(later)))], force=True):
                    continue
            earlier = [
                flat[j][0]
                for j in range(0, i)
                if flat[j][0] not in neighbors[eid] and flat[j][2] <= start
            ]
            if not earlier:
                break
            add_edge(earlier[int(rand() * min(8, len(earlier)))], eid, force=True)

    # Last resort: chain consecutive timeline neighbors (ignore timing) so none stay isolated.
    for i, (eid, *_rest) in enumerate(flat):
        if len(neighbors[eid]) >= min_deg:
            continue
        for j in (i - 1, i + 1):
            if 0 <= j < len(flat) and flat[j][0] not in neighbors[eid]:
                src, dst = (flat[j][0], eid) if j < i else (eid, flat[j][0])
                add_edge(src, dst, force=True)
            if len(neighbors[eid]) >= min_deg:
                break


# Multi-height demo: plant call-stack nests on select op1 lanes. Keys are pipe
# names from `lanes` below. `starts` are nest window origins (ns); `width` is
# each window; `depth` is the greedy first-fit rowCount target (2 or 3).
OP1_MULTIHEIGHT = {
    "SCALAR": {"depth": 3, "width": 900, "starts": (500, 4500, 9500, 15500, 22000)},
    "MTE2": {"depth": 2, "width": 1400, "starts": (2000, 8000, 14000, 21000)},
    "ALL": {"depth": 2, "width": 1100, "starts": (3000, 12000, 24000)},
}


def _nest_specs(pipe, t0, width, depth):
    """Fixed nest geometry for one window. depth=3 → 3 concurrent rows; depth=2 → 2."""
    primary = PIPE_PROFILE[pipe]["names"][0]
    mid_name = PIPE_PROFILE[pipe]["names"][1] if len(PIPE_PROFILE[pipe]["names"]) > 1 else f"{pipe}_helper"
    w = width
    if depth >= 3:
        return [
            (primary, t0, w),
            (mid_name, t0 + int(0.10 * w), int(0.75 * w)),
            (f"marker_{pipe}_a", t0 + int(0.15 * w), int(0.25 * w)),
            (f"marker_{pipe}_b", t0 + int(0.50 * w), int(0.30 * w)),
        ]
    # depth 2: outer + two sequential children on sub-row 1
    return [
        (primary, t0, w),
        (mid_name, t0 + int(0.12 * w), int(0.35 * w)),
        (f"marker_{pipe}_c", t0 + int(0.55 * w), int(0.35 * w)),
    ]


def inject_multiheight_nests(pid, tid, pipe, emitted, rand, id_prefix, plan):
    """
    Carve nest windows out of a bursty exclusive lane and fill each with a
    call-stack nest so layout assigns `plan['depth']` sub-rows.

    Demo-only exception to the usual .rep exclusivity guarantee.
    """
    depth = plan["depth"]
    width = plan["width"]
    windows = [(t0, t0 + width) for t0 in plan["starts"]]

    def overlaps_window(s, e):
        for w0, w1 in windows:
            if s < w1 and e > w0:
                return True
        return False

    kept = [(eid, s, e, ev) for eid, s, e, ev in emitted if not overlaps_window(s, e)]
    nest = []
    seq = 0
    for nest_i, (t0, _end) in enumerate(windows):
        for name, start, dur in _nest_specs(pipe, t0, width, depth):
            eid = f"{id_prefix}-nest-{nest_i}-{seq}"
            ev = _x(
                pid, tid, name, start, dur, event_id=eid,
                extra=producer_params(pipe, name, rand, 9000 + seq, dur),
            )
            nest.append((eid, start, start + dur, ev))
            seq += 1
    merged = nest + kept
    merged.sort(key=lambda x: (x[1], x[2], x[0]))
    return merged


def small_trace():
    """
    Machine-view style (~100 X events): a few Core/pipe lanes with bursty
    irregular occupancy, Ascend-style op names, and dense 3–6 connections
    per event (cross-pipe when timing allows).

    SCALAR / MTE2 / ALL carry intentional overlapping call-stack nests
    (multi-height demo) spaced across the timeline.
    """
    rand = mulberry32(0xA11CE)
    # Calibrated so emit_bursty_lane yields ~100 X events across 7 lanes.
    time_span = 30_000
    evs = [_m_process(1, "Card0")]
    lanes = [
        (1, "SCALAR", "Core0.Cube/SCALAR"),
        (2, "MTE2",   "Core0.Cube/MTE2"),
        (3, "MTE1",   "Core0.Cube/MTE1"),
        (4, "CUBE",   "Core0.Cube/CUBE"),
        (5, "FIXP",   "Core0.Cube/FIXP"),
        (6, "MTE3",   "Core0.Vec0/MTE3"),
        (7, "ALL",    "Core0.Vec0/ALL"),
    ]
    pipe_map = {}
    for tid, pipe, label in lanes:
        evs.append(_m_thread(1, tid, label))
        lane_rand = mulberry32((0xA11CE + tid * 97) & 0xFFFFFFFF)
        emitted = emit_bursty_lane(
            1, tid, pipe, time_span, lane_rand, id_prefix=f"op1-{pipe}",
        )
        plan = OP1_MULTIHEIGHT.get(pipe)
        if plan:
            emitted = inject_multiheight_nests(
                1, tid, pipe, emitted, lane_rand, id_prefix=f"op1-{pipe}", plan=plan,
            )
        pipe_map[pipe] = emitted
        for _eid, _s, _e, ev in emitted:
            evs.append(ev)

    wire_dense_deps(pipe_map, rand, min_deg=3, max_deg=6)
    # Match stress-small band count (3).
    return _doc(evs, band_count=3, time_span=time_span, nest_card_tree=True)


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


# Cube-side (aic_*) bases for PipeUtilization — out.rep leaves these as NA.
# Ratios are the bars on the MIX Cube tab; times feed absoluteValue tooltips.
AIC_PIPE_BASES = {
    "aic_time(us)": 1.25,
    "aic_total_cycles": 2100,
    "aic_cube_time(us)": 0.72,
    "aic_cube_ratio": 0.58,
    "aic_mte1_time(us)": 0.35,
    "aic_mte1_ratio": 0.28,
    "aic_mte2_time(us)": 0.81,
    "aic_mte2_ratio": 0.65,
    "aic_mte3_time(us)": 0.18,
    "aic_mte3_ratio": 0.14,
    "aic_mte3_active_bw(GB/s)": 42.5,
    "aic_fixpipe_time(us)": 0.22,
    "aic_fixpipe_ratio": 0.18,
    "aic_fixpipe_active_bw(GB/s)": 28.0,
    "aic_icache_miss_rate": 0.012,
    "aic_scalar_time(us)": 0.31,
    "aic_scalar_ratio": 0.25,
    "aic_scalar_single_time(us)": 0.12,
    "aic_scalar_dual_time(us)": 0.19,
    "aic_scalar_mte1_stall_time(us)": 0.04,
    "aic_scalar_mte2_stall_time(us)": 0.06,
    "aic_scalar_mte3_stall_time(us)": 0.02,
    "aic_scalar_cube_stall_time(us)": 0.08,
    "aic_scalar_wait_ib_time(us)": 0.01,
    "aic_scalar_wait_time(us)": 0.03,
}

AIC_ARITH_BASES = {
    "aic_time(us)": 1.25,
    "aic_total_cycles": 2100,
    "aic_cube_ratio": 0.58,
    "aic_cube_fp16_ratio": 0.41,
    "aic_cube_int8_ratio": 0.17,
    # fops ≈ measured_TFLOPS * time_us * 1e6  (≈25 TFLOPS @ 1.25 µs → 3.125e7)
    "aic_cube_fops": 31_250_000,
    "aic_cube_total_instr_number": 1200,
    "aic_cube_fp_instr_number": 850,
    "aic_cube_int_instr_number": 350,
}

AIC_CONFLICT_BASES = {
    "aic_time(us)": 1.25,
    "aic_total_cycles": 2100,
    "aic_cube_wait_ratio": 0.08,
    "aic_mte1_wait_ratio": 0.05,
    "aic_mte2_wait_ratio": 0.12,
    "aic_mte3_wait_ratio": 0.03,
}


def fill_aic_columns(text, bases, seed, scale=1.0):
    """Replace NA aic_* cells with jittered values so the Cube pipe tab has bars."""
    lines = text.rstrip("\n").split("\n")
    if not lines:
        return text
    headers = [h.strip() for h in lines[0].split(",")]
    rand = mulberry32(seed)
    out = [lines[0]]
    for row_i, line in enumerate(lines[1:]):
        if not line.strip():
            continue
        cells = line.split(",")
        # pad / trim to header width
        while len(cells) < len(headers):
            cells.append("")
        cells = cells[:len(headers)]
        for j, h in enumerate(headers):
            if h not in bases:
                continue
            if cells[j].strip() not in ("", "NA"):
                continue
            # Per-row / per-column jitter so bars differ across blocks.
            jitter = 0.75 + 0.5 * rand()
            row_bias = 0.9 + 0.2 * ((row_i * 17 + j) % 7) / 6.0
            cells[j] = _fmt(bases[h] * scale * jitter * row_bias)
        out.append(",".join(cells))
    return "\n".join(out) + "\n"


def enrich_cube_csvs(text_by_name, *, seed, scale=1.0):
    """Fill Cube-side NA columns on the metric CSVs the aside actually reads."""
    if "PipeUtilization.csv" in text_by_name:
        text_by_name["PipeUtilization.csv"] = fill_aic_columns(
            text_by_name["PipeUtilization.csv"], AIC_PIPE_BASES, seed, scale,
        )
    if "ArithmeticUtilization.csv" in text_by_name:
        text_by_name["ArithmeticUtilization.csv"] = fill_aic_columns(
            text_by_name["ArithmeticUtilization.csv"], AIC_ARITH_BASES, seed + 1, scale,
        )
    if "ResourceConflictRatio.csv" in text_by_name:
        text_by_name["ResourceConflictRatio.csv"] = fill_aic_columns(
            text_by_name["ResourceConflictRatio.csv"], AIC_CONFLICT_BASES, seed + 2, scale,
        )
    return text_by_name


def _is_dimensionless(header):
    """Ratio / percent columns are magnitudes already — scaling them fabricates impossible data.

    Token-aware so a magnitude column whose *name* merely contains the letters (e.g.
    `Task Duration(us)`) is not mistaken for a ratio.
    """
    h = header.strip().lower()
    return h.endswith("(%)") or "_ratio" in h or h.endswith("ratio") or "_rate" in h


def transform_metric_csv(text, scale, block_offset, sub_label, n_rows):
    """Rewrite a block_id/sub_block_id CSV with a new block range + scaled values.

    The scale tunes the magnitude columns (durations, bytes, counts); dimensionless columns are
    left alone, so `aiv_total_hit_rate(%)` stays a hit rate instead of the sample's 0.60%.
    """
    lines = text.rstrip("\n").split("\n")
    header = lines[0]
    headers = [h.strip() for h in header.split(",")]
    fixed = {j for j, h in enumerate(headers) if _is_dimensionless(h)}
    data = lines[1:]
    out = [header]
    for i in range(n_rows):
        cells = data[i % len(data)].split(",")
        if len(cells) >= 2:
            cells[0] = str(block_offset + i)
            cells[1] = sub_label
        for j in range(2, len(cells)):
            if j in fixed:
                continue
            c = cells[j].strip()
            if c == "NA" or c == "":
                continue
            try:
                cells[j] = _fmt(float(c) * scale)
            except ValueError:
                pass
        out.append(",".join(cells))
    return "\n".join(out) + "\n"


def transform_op_basic_info(text, *, op_name="matmul_mock", op_type="mix",
                            duration="3.502000", block_dim="16", mix_dim="8",
                            freq="1500"):
    """Swap the single OpBasicInfo row for a different operator identity."""
    header = text.split("\n", 1)[0]
    row = f"{op_name},{op_type},{duration},{block_dim},{mix_dim},0,3073000,{freq},{freq},"
    return header + "\n" + row + "\n"


def hardware_info(chip_info, ai_core_count, ai_vector_count, freq_mhz=1650, roofline_scale=1.0):
    """Product-style spaced HardwareInfo.jsonl keys, plus a Roofline category."""
    lines = [
        {"category": "Host Info", "cpu physical count": 2, "cpu logical count": 46,
         "memory total size(MB)": 515563.11, "disk total size(GB)": 5864.53},
        {"category": "Device Info", "npu count": 1, "chip info": chip_info, "arch info": "3510"},
        {"category": "CPU Information", "control cpu count": 1, "ai cpu count": 6,
         "ai cpu frequency(MHZ)": 1500},
        {"category": "AI Core Information", "ai core count": ai_core_count,
         "ai cube count": ai_core_count, "ai vector count": ai_vector_count,
         "ai cube frequency(MHZ)": freq_mhz, "ai vector frequency(MHZ)": freq_mhz},
        {"category": "Memory Information", "hbm total(MB)": 131072,
         "hbm used(MB)": 5190.55, "hbm frequency(MHZ)": 3200},
        roofline_category(roofline_scale),
    ]
    return "\n".join(json.dumps(x, ensure_ascii=False) for x in lines) + "\n"


def roofline_category(scale):
    """§11.8.2 Roofline circles (w/t/q) so the chart is more than the GM fallback dot."""
    def pt(p_peak, w, t, q, b_peak=1600):
        return {"p_peak": p_peak, "b_peak": b_peak, "w": w * scale, "t": t, "q": q}

    return {
        "category": "Roofline",
        "aiv_simd_b16": pt(2.7e13, 8e11, 0.05, 4e8),
        "aiv_simt_b16": pt(1.35e13, 4e11, 0.04, 8e8, 800),
        "aiv_simd_b32": pt(1.35e13, 2e11, 0.08, 2e8),
        "aic_b16": pt(4.3e14, 6e12, 0.02, 1e9, 800),
        "aic_b32": pt(2.7e13, 1.2e12, 0.03, 6e8),
        "aic_b8": pt(8.6e14, 9e12, 0.015, 5e8),
    }


# Ascend C sample kernels (original; same shape as a cann/ops-math op_kernel:
# __aicore__ class, TPipe queues, DataCopy / Mmad / Fixpipe). Hot lines are
# located by needle so Code frames and symbolizer stay on the real statements.
# Previous pack was 32 source lines and 8 instructions; these are >= 5× that.
CUBE_OP_CPP = """/* !
 * \\file cube_op.cpp
 * \\brief Cube matmul kernel: GM -> L1 -> L0A/L0B -> L0C -> GM.
 */
#include "kernel_operator.h"
#include "b.h"

using namespace AscendC;

constexpr int32_t BUFFER_NUM = 2;

struct CubeTiling {
    uint32_t M;
    uint32_t N;
    uint32_t K;
    uint32_t singleCoreM;
    uint32_t singleCoreN;
    uint32_t baseM;
    uint32_t baseN;
    uint32_t baseK;
};

class KernelCube {
public:
    __aicore__ inline KernelCube() {}

    __aicore__ inline void Init(__gm__ uint8_t *a, __gm__ uint8_t *b, __gm__ uint8_t *c,
                                const CubeTiling &t)
    {
        tiling = t;
        aGm.SetGlobalBuffer((__gm__ half *)a);
        bGm.SetGlobalBuffer((__gm__ half *)b);
        cGm.SetGlobalBuffer((__gm__ float *)c);
        pipe.InitBuffer(inQueueA1, BUFFER_NUM, t.baseM * t.baseK * sizeof(half));
        pipe.InitBuffer(inQueueB1, BUFFER_NUM, t.baseK * t.baseN * sizeof(half));
        pipe.InitBuffer(inQueueA2, BUFFER_NUM, t.baseM * t.baseK * sizeof(half));
        pipe.InitBuffer(inQueueB2, BUFFER_NUM, t.baseK * t.baseN * sizeof(half));
        pipe.InitBuffer(outQueueCO1, BUFFER_NUM, t.baseM * t.baseN * sizeof(float));
        mmadParams.m = t.baseM;
        mmadParams.n = t.baseN;
        mmadParams.k = t.baseK;
        mmadParams.isBias = false;
    }

    __aicore__ inline void Process()
    {
        int32_t mBlocks = (tiling.singleCoreM + tiling.baseM - 1) / tiling.baseM;
        int32_t nBlocks = (tiling.singleCoreN + tiling.baseN - 1) / tiling.baseN;
        int32_t kBlocks = (tiling.K + tiling.baseK - 1) / tiling.baseK;
        for (int32_t mIdx = 0; mIdx < mBlocks; ++mIdx) {
            for (int32_t nIdx = 0; nIdx < nBlocks; ++nIdx) {
                for (int32_t kIdx = 0; kIdx < kBlocks; ++kIdx) {
                    CopyIn(mIdx, nIdx, kIdx);
                    SplitAB();
                    Compute(kIdx == 0);
                }
                CopyOut(mIdx, nIdx);
            }
        }
    }

private:
    __aicore__ inline void CopyIn(int32_t mIdx, int32_t nIdx, int32_t kIdx)
    {
        LocalTensor<half> a1 = inQueueA1.AllocTensor<half>();
        LocalTensor<half> b1 = inQueueB1.AllocTensor<half>();
        uint32_t offsetA = (mIdx * tiling.baseM) * tiling.K + kIdx * tiling.baseK;
        uint32_t offsetB = (kIdx * tiling.baseK) * tiling.N + nIdx * tiling.baseN;
        DataCopy(a1, aGm[offsetA], tiling.baseM * tiling.baseK);
        DataCopy(b1, bGm[offsetB], tiling.baseK * tiling.baseN);
        inQueueA1.EnQue(a1);
        inQueueB1.EnQue(b1);
    }

    __aicore__ inline void SplitAB()
    {
        LocalTensor<half> a1 = inQueueA1.DeQue<half>();
        LocalTensor<half> b1 = inQueueB1.DeQue<half>();
        LocalTensor<half> a2 = inQueueA2.AllocTensor<half>();
        LocalTensor<half> b2 = inQueueB2.AllocTensor<half>();
        LoadData(a2, a1, load2dParams);
        LoadData(b2, b1, load2dParams);
        inQueueA2.EnQue(a2);
        inQueueB2.EnQue(b2);
        inQueueA1.FreeTensor(a1);
        inQueueB1.FreeTensor(b1);
    }

    __aicore__ inline void Compute(bool initC)
    {
        LocalTensor<half> a2 = inQueueA2.DeQue<half>();
        LocalTensor<half> b2 = inQueueB2.DeQue<half>();
        LocalTensor<float> c1 = outQueueCO1.AllocTensor<float>();
        mmadParams.cmatrixInitVal = initC;
        Mmad(c1, a2, b2, mmadParams);
        outQueueCO1.EnQue(c1);
        inQueueA2.FreeTensor(a2);
        inQueueB2.FreeTensor(b2);
    }

    __aicore__ inline void CopyOut(int32_t mIdx, int32_t nIdx)
    {
        LocalTensor<float> c1 = outQueueCO1.DeQue<float>();
        uint32_t offset = (mIdx * tiling.baseM) * tiling.N + nIdx * tiling.baseN;
        DataCopy(cGm[offset], c1, tiling.baseM * tiling.baseN);
        outQueueCO1.FreeTensor(c1);
    }

    TPipe pipe;
    CubeTiling tiling;
    GlobalTensor<half> aGm;
    GlobalTensor<half> bGm;
    GlobalTensor<float> cGm;
    TQue<TPosition::A1, BUFFER_NUM> inQueueA1;
    TQue<TPosition::B1, BUFFER_NUM> inQueueB1;
    TQue<TPosition::A2, BUFFER_NUM> inQueueA2;
    TQue<TPosition::B2, BUFFER_NUM> inQueueB2;
    TQue<TPosition::CO1, BUFFER_NUM> outQueueCO1;
    LoadData2DParams load2dParams;
    MmadParams mmadParams;
};

extern "C" __global__ __aicore__ void cube_op(__gm__ uint8_t *a, __gm__ uint8_t *b,
                                              __gm__ uint8_t *c, CubeTiling tiling)
{
    KernelCube op;
    op.Init(a, b, c, tiling);
    op.Process();
}
"""

MTE_COPY_CPP = """/* !
 * \\file mte_copy.cpp
 * \\brief MTE2: ND Global Memory tile to L1 NZ.
 */
#include "kernel_operator.h"
#include "b.h"

using namespace AscendC;

class KernelMteCopy {
public:
    __aicore__ inline void Init(__gm__ uint8_t *gm, uint32_t rows, uint32_t cols)
    {
        this->rows = rows;
        this->cols = cols;
        srcGm.SetGlobalBuffer((__gm__ half *)gm);
        pipe.InitBuffer(inQueue, 2, align32(rows * cols) * sizeof(half));
    }

    __aicore__ inline void Process(uint32_t blockIdx)
    {
        uint32_t tile = static_cast<uint32_t>(tile_n());
        uint32_t offset = tile_offset(blockIdx, 0, cols);
        CopyGmToL1(offset, tile);
    }

private:
    __aicore__ inline void CopyGmToL1(uint32_t offset, uint32_t tile)
    {
        LocalTensor<half> l1Local = inQueue.AllocTensor<half>();
        Nd2NzParams nd2nz;
        nd2nz.ndNum = 1;
        nd2nz.nValue = rows;
        nd2nz.dValue = tile;
        nd2nz.srcNdMatrixStride = 0;
        nd2nz.srcDValue = cols;
        nd2nz.dstNzC0Stride = align32(rows);
        nd2nz.dstNzNStride = 1;
        nd2nz.dstNzMatrixStride = 0;
        DataCopy(l1Local, srcGm[offset], nd2nz);
        inQueue.EnQue(l1Local);
    }

    TPipe pipe;
    uint32_t rows;
    uint32_t cols;
    GlobalTensor<half> srcGm;
    TQue<TPosition::A1, 2> inQueue;
};

extern "C" __global__ __aicore__ void mte_copy(__gm__ uint8_t *gm, uint32_t rows, uint32_t cols)
{
    KernelMteCopy op;
    op.Init(gm, rows, cols);
    op.Process(GetBlockIdx());
}
"""

FIXP_LOC_CPP = """/* !
 * \\file fixp_loc.cpp
 * \\brief Fixpipe: L0C float tile to GM half, scalar quant.
 */
#include "kernel_operator.h"
#include "b.h"

using namespace AscendC;

class KernelFixp {
public:
    __aicore__ inline void Init(__gm__ uint8_t *dst, uint32_t n)
    {
        this->n = n;
        dstGm.SetGlobalBuffer((__gm__ half *)dst);
        pipe.InitBuffer(outQueue, 1, align32(n) * sizeof(float));
    }

    __aicore__ inline void Process(uint32_t blockIdx)
    {
        LocalTensor<float> l0c = outQueue.AllocTensor<float>();
        uint32_t offset = tile_offset(blockIdx, 0, n);
        Store(l0c, offset);
        outQueue.FreeTensor(l0c);
    }

private:
    __aicore__ inline void Store(const LocalTensor<float> &l0c, uint32_t offset)
    {
        FixpipeParamsV220 params;
        params.nSize = n;
        params.mSize = static_cast<uint16_t>(tile_n());
        params.srcStride = align32(n);
        params.dstStride = n;
        params.quantPre = QuantMode_t::F322F16;
        params.reluEn = false;
        Fixpipe(dstGm[offset], l0c, params);
    }

    TPipe pipe;
    uint32_t n;
    GlobalTensor<half> dstGm;
    TQue<TPosition::CO1, 1> outQueue;
};

extern "C" __global__ __aicore__ void fixp_loc(__gm__ uint8_t *dst, uint32_t n)
{
    KernelFixp op;
    op.Init(dst, n);
    op.Process(GetBlockIdx());
}
"""

MATMUL_B_H = """/* !
 * \\file b.h
 * \\brief Tile shape shared by the cube, MTE, and fixpipe kernels.
 */
#pragma once
#include <cstdint>

constexpr uint32_t TILE_M = 128;
constexpr uint32_t TILE_N = 256;
constexpr uint32_t TILE_K = 64;
constexpr uint32_t C0_SIZE = 16;
constexpr uint32_t L1_PING_PONG = 2;

inline int tile_n() { return 16; }

__aicore__ inline uint32_t tile_offset(uint32_t block, uint32_t tile, uint32_t stride)
{
    return block * stride + tile * static_cast<uint32_t>(tile_n());
}

__aicore__ inline uint32_t align32(uint32_t n)
{
    return (n + 31u) & ~31u;
}

struct TileShape {
    uint32_t m;
    uint32_t n;
    uint32_t k;

    __aicore__ inline uint32_t area() const
    {
        return m * n;
    }
};
"""


def _line_of(text, needle):
    for i, line in enumerate(text.splitlines(), 1):
        if needle in line:
            return i
    raise RuntimeError(f"sample source is missing {needle!r}")


def _bind_source_frames():
    """Point Code frames at the statements the disassembly maps."""
    global SOURCE_FRAMES
    SOURCE_FRAMES = [
        (CUBE_SRC_PATH, _line_of(CUBE_OP_CPP, "Mmad(")),
        (MTE_SRC_PATH, None),
        (FIXP_SRC_PATH, _line_of(FIXP_LOC_CPP, "Fixpipe(")),
        (TILE_SRC_PATH, _line_of(MATMUL_B_H, "inline int tile_n()")),
    ]


# llvm-objdump shape. `site` ties a PC to a source statement (or Line 0).
# Order of first appearance is cube, mte, fixp, b.h — the Source file list.
_ASM_ROWS = """
cube_op | MOV | X0, PARA_BASE |
cube_op | MOVK | X0, #0, #3 |
cube_op | LDP.b32 | X3, X2, [X0], #-24 |
cube_op | LDP.b32 | X4, X1, [X0], #-16 |
cube_op | MOV | X7, PARA_BASE |
cube_op | LD_IO.b64 | X10, [X7], #0, #0 |
cube_op | SET_FLAG | MTE2, MTE1, EVENT_ID0 | mmad
cube_op | WAIT_FLAG | MTE2, MTE1, EVENT_ID0 | mmad
cube_op | ND2NZ | [L1A], [GM], X3 | mmad
cube_op | ND2NZ | [L1B], [GM], X4 | mmad
cube_op | LOAD2D | L0A, L1A, X5 | mmad
cube_op | LOAD2D | L0B, L1B, X6 | mmad
cube_op | MAD | L0C, L0A, L0B | mmad
cube_op | PIPE_BARRIER | PIPE_M |
cube_op | MOV | X15, COREID | zero
cube_op | MOV_OUT_TO_UB | UB, L0C |
cube_op | ST_IO.b64 | X2, [X13], #-40, #0 |
cube_op | ADDI | X17, X17, #2 |
mte_copy | DC_PRELOADI | [X0], #0 |
mte_copy | MOV | X17, PARA_BASE |
mte_copy | LD_XD_XN | X8, [X17], #16 | copy
mte_copy | MOVI | X29, #65184 | copy
mte_copy | ADD.s64 | X29, X29, X15 | copy
mte_copy | SHLI.b64 | X17, #14 | copy
mte_copy | MADD.s64 | X29, X15, X17 | copy
mte_copy | ST_XD_XN | [L1], X29 | copy
mte_copy | SET_FLAG | MTE2, MTE1, EVENT_ID1 |
mte_copy | WAIT_FLAG | MTE2, MTE1, EVENT_ID1 |
fixp_loc | MOV | X2, BLOCKID |
fixp_loc | DIV.u64 | X3, X2, X5 |
fixp_loc | MUL.s64 | X12, X6, X5 | fixpipe
fixp_loc | SHLI.b64 | X4, #15 | fixpipe
fixp_loc | REM.u64 | X3, X3, X6 | fixpipe
fixp_loc | SUB.s64 | X2, X2, X13 | fixpipe
fixp_loc | INSERT | X12, X3, #0, #31 | fixpipe
fixp_loc | ST_IO.b32 | X12, [X8], #8, #0 | fixpipe
fixp_loc | PIPE_BARRIER | PIPE_FIX |
tile_n | MOVI | X16, #32767 |
tile_n | AND.b64 | X15, X15, X16 |
tile_n | ADDI | X15, X15, #1 | tile
tile_n | SHLI.b64 | X2, #16 | tile
tile_n | MADD.s64 | X13, X12, X4 | tile
tile_n | OR.b64 | X2, X2, X4 | tile
tile_n | ADDI | X30, X29, #1928 |
""".strip().splitlines()


def _code_lines(text):
    """1-based statement lines a PC can land on (skip blanks, comments, braces)."""
    out = []
    for i, line in enumerate(text.splitlines(), 1):
        s = line.strip()
        if not s or s.startswith(("//", "/*", "*", "#")):
            continue
        if s in ("{", "}", "};", "public:", "private:"):
            continue
        if "(" not in s and ";" not in s:
            continue
        out.append(i)
    return out or [1]


def _build_objdump_and_symbolizer():
    """48-instruction hiipu listing (was 8) plus PC → source sites."""
    _bind_source_frames()
    site_line = {
        "mmad": (_line_of(CUBE_OP_CPP, "Mmad("), CUBE_SRC_PATH, "cube_op"),
        "copy": (_line_of(MTE_COPY_CPP, "DataCopy(l1Local"), MTE_SRC_PATH, "mte_copy"),
        "fixpipe": (_line_of(FIXP_LOC_CPP, "Fixpipe("), FIXP_SRC_PATH, "fixp_loc"),
        "tile": (_line_of(MATMUL_B_H, "inline int tile_n()"), TILE_SRC_PATH, "tile_n"),
        "zero": (0, CUBE_SRC_PATH, "cube_op"),
    }
    file_by_fn = {
        "cube_op": (CUBE_OP_CPP, CUBE_SRC_PATH, "cube_op"),
        "mte_copy": (MTE_COPY_CPP, MTE_SRC_PATH, "mte_copy"),
        "fixp_loc": (FIXP_LOC_CPP, FIXP_SRC_PATH, "fixp_loc"),
        "tile_n": (MATMUL_B_H, TILE_SRC_PATH, "tile_n"),
    }
    code_lines = {fn: _code_lines(src) for fn, (src, _path, _name) in file_by_fn.items()}
    spread_at = {fn: 0 for fn in file_by_fn}
    lines = [
        "kernel.o:\tfile format elf64-hiipu",
        "",
        "Disassembly of section .text:",
        "",
    ]
    sites = []
    prev_fn = None
    for i, row in enumerate(_ASM_ROWS):
        fn, mnem, ops, site = [part.strip() for part in row.split("|")]
        pc = 0x100 + i * 4
        if fn != prev_fn:
            lines.append(f"{pc:016x} <{fn}>:")
            prev_fn = fn
        enc = 0x02004880 + (i * 0x101) & 0xFFFFFFFF
        lines.append(f"     {pc:x}:\t{enc:08x}\t{mnem}\t{ops}")
        if site:
            line, path, name = site_line[site]
        else:
            src_lines = code_lines[fn]
            step = max(1, len(src_lines) // 8)
            line = src_lines[(spread_at[fn] * step) % len(src_lines)]
            spread_at[fn] += 1
            _src, path, name = file_by_fn[fn]
        sites.append(_sym(f"0x{pc:x}", path, line, name))
    text = "\n".join(lines) + "\n"
    mapped = {}
    for site in sites:
        sym = site["Symbol"][0]
        if sym["Line"] > 0:
            mapped.setdefault(sym["FileName"], set()).add(sym["Line"])
    for path, minimum in (
        (CUBE_SRC_PATH, 8),
        (MTE_SRC_PATH, 4),
        (FIXP_SRC_PATH, 4),
        (TILE_SRC_PATH, 3),
    ):
        got = len(mapped.get(path, ()))
        if got < minimum:
            raise RuntimeError(f"{path} maps {got} source lines, want >= {minimum}")
    src_lines = sum(len(s.splitlines()) for s in (
        CUBE_OP_CPP, MTE_COPY_CPP, FIXP_LOC_CPP, MATMUL_B_H,
    ))
    if src_lines < 32 * 5:
        raise RuntimeError(f"sample source is {src_lines} lines, want >= {32 * 5}")
    if len(_ASM_ROWS) < 8 * 5:
        raise RuntimeError(f"sample objdump is {len(_ASM_ROWS)} insns, want >= {8 * 5}")
    return text, json.dumps(sites)


_STALL_COLUMNS = (
    "IBuf_Empty",
    "Nop_Cycles",
    "Scoreboard_Not_Ready",
    "Register_bank_conflict",
    "Resource_conflict",
    "Warp_Level_Sync",
    "Divergence_Stack_Spill",
    "Others",
)


def _metric_shape(mnem, site):
    """Stall mix, instruction count, and warp occupancy for one mnemonic.

    Occupancy is a 0–1 fraction (the Source bar treats values ≤ 1 as a percent).
    Instructions Executed / Warp Occupancy are sample columns on pc_sampling;
    producer summary.db files omit them and those metrics stay 0.
    """
    key = mnem.split(".")[0]
    if site == "mmad" or key in ("MAD", "ND2NZ", "LOAD2D"):
        return 16000, (1, 2, 9, 3, 4, 1, 0, 1), 14000, 0.88
    if key in ("SET_FLAG", "WAIT_FLAG", "PIPE_BARRIER"):
        return 8000, (0, 1, 1, 0, 1, 8, 1, 1), 120, 0.28
    if site == "copy" or key in ("DC_PRELOADI", "ST_XD_XN", "LD_XD_XN"):
        return 11000, (1, 1, 3, 1, 6, 2, 1, 1), 6000, 0.64
    if site == "fixpipe" or key in ("ST_IO", "INSERT"):
        return 6000, (1, 1, 4, 1, 3, 1, 1, 1), 3200, 0.55
    if site == "tile":
        return 2200, (2, 2, 3, 2, 1, 1, 0, 2), 640, 0.42
    if site == "zero":
        return 300, (1, 2, 1, 0, 0, 0, 0, 3), 48, 0.22
    return 480, (4, 3, 1, 1, 1, 0, 0, 1), 96, 0.31


def _split_total(total, weights):
    weight = sum(weights) or 1
    counts = [total * w // weight for w in weights]
    counts[weights.index(max(weights))] += total - sum(counts)
    return counts


def build_summary_db(seed, scale):
    """SQLite pc_sampling, one row per objdump PC (same 0x100+4*i addresses)."""
    import sqlite3

    rand = mulberry32(seed)
    rows = []
    for i, row in enumerate(_ASM_ROWS):
        _fn, mnem, _ops, site = [part.strip() for part in row.split("|")]
        pc = 0x100 + i * 4
        stall_base, mix, instr_base, occ_base = _metric_shape(mnem, site)
        stall = max(1, int(stall_base * scale * (0.75 + rand() * 0.5)))
        executed = max(1, int(instr_base * scale * (0.8 + rand() * 0.4)))
        occ = occ_base * (0.92 + rand() * 0.1) * (0.9 + 0.1 * min(scale, 1.2))
        occ = max(0.05, min(0.98, occ))
        rows.append((f"0x{pc:x}", *_split_total(stall, mix), executed, occ))

    con = sqlite3.connect(":memory:")
    stall_cols = ", ".join(f'"{name}" INTEGER NOT NULL' for name in _STALL_COLUMNS)
    con.execute(
        "CREATE TABLE pc_sampling ("
        '"pc_offset" TEXT PRIMARY KEY NOT NULL, '
        f"{stall_cols}, "
        '"Instructions_Executed" INTEGER NOT NULL, '
        '"Warp_Occupancy" REAL NOT NULL)'
    )
    placeholders = ",".join(["?"] * (3 + len(_STALL_COLUMNS)))
    con.executemany(f"INSERT INTO pc_sampling VALUES ({placeholders})", rows)
    con.commit()
    blob = con.serialize()
    con.close()
    if len(blob) < 100 or not blob.startswith(b"SQLite format 3\x00"):
        raise RuntimeError("sample summary.db is not a sqlite database")
    return blob


def _sym(addr, path, line, fn):
    return {
        "Address": addr,
        "ModuleName": "kernel.o",
        "Symbol": [{
            "Column": 1,
            "Discriminator": 0,
            "FileName": path,
            "FunctionName": fn,
            "Line": line,
            "StartAddress": addr,
            "StartFileName": path,
            "StartLine": 1,
        }],
    }


OBJDUMP_TXT, SYMBOLIZER_JSON = _build_objdump_and_symbolizer()


def ub_rw_csv(seed, n=96):
    """Sparse UB accesses so the heat grid is mixed, not a solid block."""
    rand = mulberry32(seed)
    lines = ["ExecInstrId,AccessedAddress"]
    base = 0x800000
    span = 0x40000
    for _ in range(n):
        addr = base + int(rand() * span)
        instr = 1000 + int(rand() * 24)
        lines.append(f"{instr},{addr}")
    return "\n".join(lines) + "\n"


def source_demo_texts(heatmap_seed):
    """Embeds that turn on 源码 (several files), frame links, and the UB heat grid."""
    return {
        "cube_op.cpp": CUBE_OP_CPP,
        "mte_copy.cpp": MTE_COPY_CPP,
        "fixp_loc.cpp": FIXP_LOC_CPP,
        "b.h": MATMUL_B_H,
        "objdump.txt": OBJDUMP_TXT,
        "symbolizer.json": SYMBOLIZER_JSON,
        "UbRwAccesses.csv": ub_rw_csv(heatmap_seed),
    }


def scale_column_values(text, column_names, scale):
    """Multiply named CSV columns by scale (skip NA/empty)."""
    lines = text.rstrip("\n").split("\n")
    if not lines:
        return text
    headers = [h.strip() for h in lines[0].split(",")]
    idx = [i for i, h in enumerate(headers) if h in column_names]
    if not idx:
        return text
    out = [lines[0]]
    for line in lines[1:]:
        if not line.strip():
            continue
        cells = line.split(",")
        while len(cells) < len(headers):
            cells.append("")
        cells = cells[:len(headers)]
        for i in idx:
            c = cells[i].strip()
            if c in ("", "NA"):
                continue
            try:
                cells[i] = _fmt(float(c) * scale)
            except ValueError:
                pass
        out.append(",".join(cells))
    return "\n".join(out) + "\n"


def set_column_constant(text, column_name, value_fn):
    """Set column to value_fn(row_index) for every data row (or fill NA)."""
    lines = text.rstrip("\n").split("\n")
    if not lines:
        return text
    headers = [h.strip() for h in lines[0].split(",")]
    if column_name not in headers:
        return text
    j = headers.index(column_name)
    out = [lines[0]]
    for row_i, line in enumerate(lines[1:]):
        if not line.strip():
            continue
        cells = line.split(",")
        while len(cells) < len(headers):
            cells.append("")
        cells = cells[:len(headers)]
        cells[j] = _fmt(value_fn(row_i))
        out.append(",".join(cells))
    return "\n".join(out) + "\n"


def csv_column_mean(text, column_name):
    lines = text.rstrip("\n").split("\n")
    if len(lines) < 2:
        return None
    headers = [h.strip() for h in lines[0].split(",")]
    if column_name not in headers:
        return None
    j = headers.index(column_name)
    vals = []
    for line in lines[1:]:
        if not line.strip():
            continue
        cells = line.split(",")
        if j >= len(cells):
            continue
        c = cells[j].strip()
        if c in ("", "NA"):
            continue
        try:
            vals.append(float(c))
        except ValueError:
            pass
    if not vals:
        return None
    return sum(vals) / len(vals)


def category_means_from_csv(category, text):
    """Build a Summary.jsonl category object as mean of numeric columns (skip block ids)."""
    lines = text.rstrip("\n").split("\n")
    if len(lines) < 2:
        return {"category": category}
    headers = [h.strip() for h in lines[0].split(",")]
    sums = {}
    counts = {}
    for line in lines[1:]:
        if not line.strip():
            continue
        cells = line.split(",")
        for i, h in enumerate(headers):
            if h in ("block_id", "sub_block_id") or i >= len(cells):
                continue
            c = cells[i].strip()
            if c in ("", "NA"):
                continue
            try:
                v = float(c)
            except ValueError:
                continue
            sums[h] = sums.get(h, 0.0) + v
            counts[h] = counts.get(h, 0) + 1
    obj = {"category": category}
    for h, total in sums.items():
        obj[h] = total / counts[h]
    return obj


def build_summary_jsonl(texts, *, op_basic, demo):
    """OpInfoSummary + category means for product detail panels."""
    cats = [
        "PipeUtilization",
        "ArithmeticUtilization",
        "ResourceConflictRatio",
        "Memory",
        "MemoryL0",
        "MemoryUB",
        "L2Cache",
    ]
    lines = []
    for cat in cats:
        name = f"{cat}.csv"
        if name in texts:
            lines.append(category_means_from_csv(cat, texts[name]))

    mem = next((o for o in lines if o.get("category") == "Memory"), {})
    # npu-tools summarize_npu_rep.py: read / write = sum of the aic + aiv sides (non-null only).
    read_values = [
        mem[k] for k in ("aic_main_mem_read_bw(GB/s)", "aiv_main_mem_read_bw(GB/s)")
        if mem.get(k) is not None
    ]
    write_values = [
        mem[k] for k in ("aic_main_mem_write_bw(GB/s)", "aiv_main_mem_write_bw(GB/s)")
        if mem.get(k) is not None
    ]
    read_bw = sum(read_values) if read_values else demo["gm_read"]
    write_bw = sum(write_values) if write_values else demo["gm_write"]
    # npu-tools summarize_npu_rep.py: usage = mean of the non-null per-path usage-rate columns.
    usage_values = [
        mem[k]
        for k in (
            "GM_to_UB_bw_usage_rate(%)",
            "UB_to_GM_bw_usage_rate(%)",
            "GM_to_L1_bw_usage_rate(%)",
            "L1_to_GM_bw_usage_rate(%)",
        )
        if mem.get(k) is not None
    ]
    usage = round(sum(usage_values) / len(usage_values), 6) if usage_values else None

    op_info = {
        "category": "OpInfoSummary",
        "Op Name": op_basic["op_name"],
        "Op Type": op_basic["op_type"],
        "Task Duration(us)": float(op_basic["duration"]),
        "Block Dim": int(op_basic["block_dim"]),
        "Mix Block Dim": int(op_basic["mix_dim"]) if op_basic.get("mix_dim") not in (None, "", "NA") else None,
        "Device Id": 0,
        "Pid": 3073000,
        "Current Freq": int(op_basic["freq"]),
        "Rated Freq": int(op_basic["freq"]),
        "aicore_parallel_utilization": demo["parallel_util"],
        "aicore_parallel_balance": demo["parallel_balance"],
        "aicore_gm_bw_theoretical(GB/s)": 1600,
        "aicore_gm_read_bw(GB/s)": read_bw,
        "aicore_gm_write_bw(GB/s)": write_bw,
        **({"aicore_gm_bw_usage_rate(%)": usage} if usage is not None else {}),
        "aic_flops": demo["aic_flops"],
        "aiv_flops": demo["aiv_flops"],
        "aic_flops_theoretical": demo["aic_flops_theoretical"],
        "aiv_flops_theoretical": demo["aiv_flops_theoretical"],
    }
    lines.append(op_info)
    return "".join(json.dumps(o, ensure_ascii=False) + "\n" for o in lines)


def build_sampling_json(seed, duration_us, n_points=64):
    """Compact Sampling.json with CUBE + VECTOR util waves (ts in µs)."""
    rand = mulberry32(seed)
    events = [
        {"name": "Accelerator", "pid": 1, "tid": 0, "ph": "M", "cat": "__metadata",
         "args": {"name": "AI Accelerator"}},
        {"name": "CUBE", "pid": 1, "tid": 1, "ph": "M", "cat": "__metadata",
         "args": {"name": "CUBE Unit"}},
        {"name": "VECTOR", "pid": 1, "tid": 2, "ph": "M", "cat": "__metadata",
         "args": {"name": "VECTOR Unit"}},
    ]
    for i in range(n_points):
        ts = duration_us * (i / max(n_points - 1, 1))
        cube = 35 + 45 * (0.5 + 0.5 * math.sin(i / 5.0)) + 8 * (rand() - 0.5)
        vec = 30 + 40 * (0.5 + 0.5 * math.cos(i / 4.0)) + 8 * (rand() - 0.5)
        events.append({
            "name": "CUBE", "cat": "util", "ph": "C", "ts": round(ts, 6), "pid": 1,
            "args": {"value": round(max(0.0, min(100.0, cube)), 3)},
        })
        events.append({
            "name": "VECTOR", "cat": "util", "ph": "C", "ts": round(ts, 6), "pid": 1,
            "args": {"value": round(max(0.0, min(100.0, vec)), 3)},
        })
    return json.dumps({"traceEvents": events}, separators=(",", ":")) + "\n"


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

# Scale Memory main-mem BW so cards show ~30–40% of 1600 GB/s peak.
BW_COLUMNS = (
    "aic_main_mem_read_bw(GB/s)",
    "aic_main_mem_write_bw(GB/s)",
    "aiv_main_mem_read_bw(GB/s)",
    "aiv_main_mem_write_bw(GB/s)",
)


def leaf_entries(out_rep, trace, *, transform, sub_label, chip_info,
                 ai_core_count, ai_vector_count, block_offset, n_rows,
                 aic_seed, aic_scale, op_basic, demo, include_trace=True,
                 sampling_seed=0x51A1, roofline_scale=1.0, heatmap_seed=0x4E47):
    texts = {}
    for name, data in out_rep.items():
        if name == "trace.json":
            continue
        if name == "OpBasicInfo.csv":
            texts[name] = transform_op_basic_info(data.decode("utf-8"), **op_basic)
            continue
        if name in METRIC_SCALES:
            text = data.decode("utf-8")
            if transform:
                text = transform_metric_csv(
                    text, METRIC_SCALES[name], block_offset, sub_label, n_rows
                )
            texts[name] = text
        else:
            texts[name] = data.decode("utf-8")

    enrich_cube_csvs(texts, seed=aic_seed, scale=aic_scale)

    # Align vector fops with demo aiv TFLOPS (fops = TFLOPS * time_us * 1e6).
    if "ArithmeticUtilization.csv" in texts:
        aiv_time = csv_column_mean(texts["ArithmeticUtilization.csv"], "aiv_time(us)") or 1.0
        target_vec_fops = demo["aiv_flops"] * aiv_time * 1e6
        texts["ArithmeticUtilization.csv"] = set_column_constant(
            texts["ArithmeticUtilization.csv"],
            "aiv_vec_fops",
            lambda row_i: target_vec_fops * (0.92 + 0.16 * ((row_i * 13) % 5) / 4.0),
        )
        aic_time = csv_column_mean(texts["ArithmeticUtilization.csv"], "aic_time(us)") or 1.25
        target_cube_fops = demo["aic_flops"] * aic_time * 1e6
        texts["ArithmeticUtilization.csv"] = set_column_constant(
            texts["ArithmeticUtilization.csv"],
            "aic_cube_fops",
            lambda row_i: target_cube_fops * (0.92 + 0.16 * ((row_i * 7) % 5) / 4.0),
        )

    if "Memory.csv" in texts:
        # Boost main-mem BW into the demo GB/s band (~480–640).
        texts["Memory.csv"] = scale_column_values(texts["Memory.csv"], BW_COLUMNS, 28.0)
        # Ensure aic main-mem columns are populated (out.rep leaves aic as NA).
        for col, target in (
            ("aic_main_mem_read_bw(GB/s)", demo["gm_read"]),
            ("aic_main_mem_write_bw(GB/s)", demo["gm_write"]),
            ("aiv_main_mem_read_bw(GB/s)", demo["gm_read"] * 0.95),
            ("aiv_main_mem_write_bw(GB/s)", demo["gm_write"] * 0.95),
        ):
            texts["Memory.csv"] = set_column_constant(
                texts["Memory.csv"], col,
                lambda row_i, t=target: t * (0.9 + 0.2 * ((row_i * 3) % 4) / 3.0),
            )

    texts["HardwareInfo.jsonl"] = hardware_info(
        chip_info, ai_core_count, ai_vector_count,
        freq_mhz=int(op_basic.get("freq", 1650)),
        roofline_scale=roofline_scale,
    )
    texts.update(source_demo_texts(heatmap_seed))
    texts["statistical_utilization.json"] = json.dumps({"operator": sub_label}) + "\n"
    texts["Summary.jsonl"] = build_summary_jsonl(texts, op_basic=op_basic, demo=demo)
    texts["Sampling.json"] = build_sampling_json(
        sampling_seed, float(op_basic["duration"]) * 8.0, n_points=48,
    )
    summary_db = build_summary_db(heatmap_seed, roofline_scale)

    payloads = []
    if include_trace and trace is not None:
        payloads.append(("trace.json", TYPE_JSON, trace))

    for name, text in texts.items():
        if name.endswith(".csv"):
            typ = TYPE_CSV
        elif name.endswith(".jsonl"):
            typ = TYPE_JSONL
        elif name.endswith((".txt", ".cpp", ".h", ".asc")):
            typ = TYPE_TXT
        else:
            typ = TYPE_JSON
        payloads.append((name, typ, text.encode("utf-8")))

    payloads.append(("summary.db", TYPE_SQLITE, summary_db))
    payloads.sort(key=lambda p: p[0])
    return payloads


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    out_rep = read_out_rep(os.path.join(here, "out.rep"))

    op1_demo = {
        "parallel_util": 0.88,
        "parallel_balance": 0.91,
        "aic_flops": 25.0,
        "aiv_flops": 12.0,
        "aic_flops_theoretical": 60.8256,
        "aiv_flops_theoretical": 30.4128,
        "gm_read": 560.0,
        "gm_write": 480.0,
    }
    op2_demo = {
        "parallel_util": 0.93,
        "parallel_balance": 0.89,
        "aic_flops": 25.0,
        "aiv_flops": 10.0,
        "aic_flops_theoretical": 36.864,
        "aiv_flops_theoretical": 18.432,
        "gm_read": 640.0,
        "gm_write": 520.0,
    }

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
        aic_seed=0xC0BE01,
        aic_scale=0.85,
        op_basic={"op_name": "add_custom", "op_type": "mix", "duration": "1.800036",
                  "block_dim": "8", "mix_dim": "4", "freq": "1650"},
        demo=op1_demo,
        sampling_seed=0x51A101,
        roofline_scale=1.0,
        heatmap_seed=0x4E4701,
    )
    op2 = leaf_entries(
        out_rep,
        trace=None,
        transform=True,
        sub_label="vector1",
        chip_info="Ascend 910B",
        ai_core_count=24,
        ai_vector_count=48,
        block_offset=100,
        n_rows=12,
        aic_seed=0xC0BE02,
        aic_scale=1.15,
        op_basic={"op_name": "matmul_mock", "op_type": "mix", "duration": "3.502000",
                  "block_dim": "16", "mix_dim": "8", "freq": "1500"},
        demo=op2_demo,
        include_trace=False,
        sampling_seed=0x51A102,
        roofline_scale=0.72,
        heatmap_seed=0x4E4702,
    )

    op1_bytes = pack_npu_rep(op1)
    op2_bytes = pack_npu_rep(op2)
    container = pack_npu_rep([
        ("op1.npu.rep", TYPE_NESTED, op1_bytes),
        ("op2.npu.rep", TYPE_NESTED, op2_bytes),
    ])

    out_path = os.path.join(here, "sample.lite.rep")
    with open(out_path, "wb") as fp:
        fp.write(container)

    print(f"[OK] wrote {out_path} ({len(container)} bytes)")
    print(f"     op1 leaf: {len(op1_bytes)} bytes, {len(op1)} files")
    print(f"     op2 leaf: {len(op2_bytes)} bytes, {len(op2)} files")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "--pack-parity":
        # Fixed entry set for tests/unit/packNpuRep.spec.ts ↔ packNpuRep.ts parity.
        # Note: product 160-byte layout; packNpuRep.ts (164) has its own fixtures.
        parity = pack_npu_rep([
            ("OpBasicInfo.csv", TYPE_CSV, b"a,b\n1,2"),
            ("trace.json", TYPE_JSON, b"{}"),
        ])
        sys.stdout.buffer.write(parity)
        sys.exit(0)

    main()
