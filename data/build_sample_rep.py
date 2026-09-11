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

  type 1 = nested operator archive; 2 = json; 3 = jsonl; 4 = csv.

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


# Sketch Parameter column fields (VIEW_DATA_MAPPING §11.2.8.1). op2 omits Code
# paths so the ~150k-event fixture stays near ~30 MB.
CODE_PATHS = [
    "/opt/ascend/tikcpp/impl/cube_op.cpp",
    "/opt/ascend/tikcpp/lib/matmul/b.h",
    "/home/ops/kernels/mte_copy.cpp",
    "/home/ops/kernels/fixp_loc.cpp",
]


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
        code = [CODE_PATHS[int(rand() * len(CODE_PATHS))]]
        if rand() < 0.35:
            second = CODE_PATHS[int(rand() * len(CODE_PATHS))]
            if second not in code:
                code.append(second)
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


def transform_op_basic_info(text, *, op_name="matmul_mock", op_type="mix",
                            duration="3.502000", block_dim="16", mix_dim="8",
                            freq="1500"):
    """Swap the single OpBasicInfo row for a different operator identity."""
    header = text.split("\n", 1)[0]
    row = f"{op_name},{op_type},{duration},{block_dim},{mix_dim},0,3073000,{freq},{freq},"
    return header + "\n" + row + "\n"


def hardware_info(chip_info, ai_core_count, ai_vector_count, freq_mhz=1650):
    """Product-style spaced HardwareInfo.jsonl keys."""
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
    ]
    return "\n".join(json.dumps(x, ensure_ascii=False) for x in lines) + "\n"


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
                 sampling_seed=0x51A1):
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
        chip_info, ai_core_count, ai_vector_count, freq_mhz=int(op_basic.get("freq", 1650)),
    )
    texts["statistical_utilization.json"] = json.dumps({"operator": sub_label}) + "\n"
    texts["Summary.jsonl"] = build_summary_jsonl(texts, op_basic=op_basic, demo=demo)
    texts["Sampling.json"] = build_sampling_json(
        sampling_seed, float(op_basic["duration"]) * 8.0, n_points=48,
    )

    payloads = []
    if include_trace and trace is not None:
        payloads.append(("trace.json", TYPE_JSON, trace))

    for name, text in texts.items():
        if name.endswith(".csv"):
            typ = TYPE_CSV
        elif name.endswith(".jsonl"):
            typ = TYPE_JSONL
        else:
            typ = TYPE_JSON
        payloads.append((name, typ, text.encode("utf-8")))

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
