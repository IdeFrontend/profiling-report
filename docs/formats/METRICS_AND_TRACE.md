# Metrics CSVs and Trace Semantics

How embedded files inside a `.rep` / `.ncrep` map to UI panels, and what the sample `trace.json` actually contains.

## Common CSV conventions

Most metric CSVs are keyed by:

| Column | Meaning |
|--------|---------|
| `block_id` | AI Core / block index (0…N−1) |
| `sub_block_id` | Sub-unit label (sample: `vector0`) |

Dual-prefix fields:

- `aic_*` — AI Cube / AIC-side counters (often `NA` for vector-only kernels)
- `aiv_*` — AI Vector / AIV-side counters

Missing values appear as the token `NA` (not empty). Aggregations for UI should ignore `NA` or treat as null.

Time units in CSVs are typically **microseconds** (`*(us)`). Bandwidth columns use **GB/s**. Ratios are unitless fractions (0–1) unless labeled `%`.

---

## File → UI mapping

| Embedded file | Feeds (MVP) | Feeds (Phase 2+) |
|---------------|-------------|------------------|
| `OpBasicInfo.csv` | Report summary: op name, type, task duration, block dim, device, frequencies | Hardware/op header, OP算子 tab |
| `PipeUtilization.csv` | PIPE occupancy bars; lane utilization % on gutter (pipe-ratio legacy default); **时钟周期** gutter mode | Searchable pipe field list (`source/v930/compute-load.jpeg`, `source/v930/compute-load-detail.jpeg`) |
| `ArithmeticUtilization.csv` | Compute / TFLOPS-style summary inputs; Cube vs Vector split | Roofline point inputs (Vec_FP32, Vec_MISC, …) |
| `Memory.csv` | Optional summary I/O bandwidth tiles (DATA-33g) | Memory topology diagram + field drill-down |
| `MemoryL0.csv` | — | L0 path details on memory diagram |
| `MemoryUB.csv` | — | UB path details |
| `L2Cache.csv` | — | Cache tab / L2 hit-rate panels |
| `ResourceConflictRatio.csv` | — | Stall/conflict insights in details |
| `trace.json` | Swimlane lanes and event intervals | Dependency overlays if args provide them; markers |

Sketches: [`docs/ui/`](../ui/).

---

## OpBasicInfo.csv

Sample row (abridged):

| Field | Sample | UI use |
|-------|--------|--------|
| Op Name | `add_custom` | Title / breadcrumb |
| Op Type | `vector` | Badge / filter |
| Task Duration(us) | `1.800036` | Total time |
| Block Dim | `8` | Aside **Blocks**; duration secondary + bar util (DATA-33e / DATA-1–32) |
| Mix Block Dim | `NA` | Mix mode (later) |
| Device Id | `0` | Device label |
| Pid | process id | Aside **进程** |
| Current Freq / Rated Freq | e.g. `1650` | Hardware overlay; not on the v930 header |

---

## PipeUtilization.csv

Primary source for **PIPE 占用率** and per-core utilization bars.

Important AIV columns (sample is vector-heavy):

| Column | Role |
|--------|------|
| `aiv_time(us)`, `aiv_total_cycles` | Block duration / cycles — **`*_total_cycles` is not used** for Card gutter **时钟周期** (that mode uses pipe `*_time(us)` only; see [gutter-metrics.spec.md](../../specs/core/gutter-metrics.spec.md)) |
| `aiv_vec_time(us)`, `aiv_vec_ratio` | Vector pipe |
| `aiv_mte2_*`, `aiv_mte3_*` | MTE pipes + active BW |
| `aiv_scalar_*` | Scalar time, stalls, waits |
| `aiv_icache_miss_rate` | I-cache |

AIC counterparts (`aic_cube_*`, `aic_mte*_*`, `aic_fixpipe_*`, …) populate Cube / FixPipe bars when present.

**MVP aggregation ([DATA-33b](../context/decisions/interim/DATA.md)):** for each pipe family (Cube, Vector, MTE1–3, FixP, Scalar), take the **mean of non-`NA` ratios** across `block_id` rows. Display as horizontal bars matching [COLOR_TOKENS](../ui/COLOR_TOKENS.md). Superseded when DATA-33 / data spec says otherwise.

**Overview Cube/Vector charts:** Product decision ([DATA-32](../context/decisions/DATA.md)) — **hide** until `OverviewSeries` is supplied by a future producer/data spec. Do **not** derive from PipeUtilization ratios.

**Lane hierarchy:** Use producer `thread_name` / process names as-is ([DATA-35](../context/decisions/DATA.md)); do not invent Card/`CoreN.*` hierarchy in the viewer from flat AIV pipe strings. Nested Card → category → Core → pipe trees come from explicit `SwimThread.children` (stress / future producer), not CTEF heuristics.

### Gutter metric modes (Card-header selector)

Per-Card dropdown on swimlane Card strips. Normative formula: [gutter-metrics.spec.md](../../specs/core/gutter-metrics.spec.md) § **clockCycle formula**.

| Mode | Quantity | Primary embed | Notes |
|------|----------|---------------|-------|
| 时钟周期 (`clockCycle`) | Mean pipe **active time (µs)** — UI label says “Clock Cycle”, values are **not** cycle counts | `PipeUtilization.csv` mapped `*_time(us)` only (see gutter-metrics column map) | Label suffix **`µs`**; hide when no mappable time data; **ignore** `*_total_cycles` |
| 利用率 (`utilization`) | Event coverage % over model time span | `trace.json` | Always when trace exists |

Default: **时钟周期** when available, else **利用率**. Aside PIPE **ratio** bars stay [DATA-33b](../context/decisions/interim/DATA.md); aside in-bar absolute times stay [DATA-33f](../context/decisions/interim/DATA.md) (same `*_time(us)` means as gutter clockCycle raw, different UI). **Product confirmation:** [DATA-38](../context/questions/DATA.md), [DATA-38a](../context/decisions/interim/DATA.md), [UI-46](../context/questions/UI.md), [UI-46a](../context/decisions/interim/UI.md).

**Fill / midline:** utilization — red when < 50%, dash at 50%. clockCycle — red on max lane(s) only (all gray when tied); dash at `(mean raw ÷ max raw) × 100`.

---

## ArithmeticUtilization.csv

| Column group | Role |
|--------------|------|
| `aic_cube_*_ratio`, `aic_cube_fops` | Cube arithmetic intensity / FOPS |
| `aiv_vec_*_ratio`, `aiv_vec_fops` | Vector FP32/FP16/int/misc split |

Used for summary “computing power” tiles and later **roofline** category points (`Vec_FP32`, `Vec_MISC`, …).

---

## Memory*.csv and L2Cache.csv

| File | Highlights |
|------|------------|
| `Memory.csv` | L1/GM/UB BW, MTE instruction counts, path datas (KB) and BW usage % |
| `MemoryL0.csv` | L0A/L0B/L0C BW |
| `MemoryUB.csv` | UB vector/scalar R/W BW |
| `L2Cache.csv` | Write/read hits, miss-allocate, hit rates (%) |

Phase 2 memory diagram (`source/v930/memory-load-detail.jpeg`, `source/v930/memory-load-detail.jpeg`): **static SVG** topology with **data-driven edge labels** from these fields ([UI-38](../context/decisions/UI.md)). Edge geometry/thickness stays in the SVG asset. Detail lists can mirror CSV headers 1:1.

---

## ResourceConflictRatio.csv

Wait and conflict ratios (`aic_*_wait_ratio`, `aiv_vec_*_cflt_ratio`, …). Phase 2 diagnostics; not required for MVP swimlane.

---

## trace.json (Chrome Trace)

### Shape (sample)

```json
{
  "displayTimeUnit": "ns",
  "traceEvents": [ /* metadata + complete events */ ]
}
```

### Sample content characteristics

| Property | Sample `data/out.rep` |
|----------|------------------------|
| Event count | ~61 (7 metadata + 54 complete) |
| Metadata | `ph: "M"`, `name: "thread_name"` |
| Threads | `AIV0/PIPE_{S,V,M,MTE1,MTE2,MTE3,FIX}/status` |
| Complete events | `ph: "X"` with `ts`, `dur` |
| Categories | `PIPE_STATE` (state markers), `pipe_state_busy` (busy intervals) |
| Case id (args) | e.g. `MYPROF_20260711_102038`, `channel: "aiv0"` |

Busy events such as `PIPE_V_busy` / `PIPE_S_busy` are the natural rectangles for swimlane lanes. Marker events carry bitfield-like `state_PIPE_*` args useful for debugging, not necessarily as separate painted intervals.

### Mapping to swimlane model

Recommended library mapping:

```text
pid / process     → Card / process group (flat CTEF: e.g. Process 2 / AIV0)
tid / thread_name → leaf lane (PIPE_V, PIPE_S, …) — no nesting from CTEF alone
ph=X event        → Event { name, startTime=ts, duration=dur, args }
```

Time unit: prefer nanoseconds internally; convert UI axis to ms as in sketches (`0.0ms` …).

### Gap vs UI sketches

Design sketches show a **Card → 通信/计算/储存HBM → CoreN.Cube/Vec → pipe** Gantt with named ops (`MOV_OUT_TO_L1_MULTI_ND2NZ`, `DC_PRELOAD_XN_IMM`, `ProfilerStep#N`, Aten ops) and dependency links. Only Card is a group header; nested folders are lane-style rows.

The sample `out.rep` trace is a **single-channel AIV pipe-state busy timeline**, not that Card tree. Playground stress presets synthesize the Card hierarchy via `SwimThread.children`.

| Expectation | Sample reality | Spec stance |
|-------------|----------------|-------------|
| Card → category → Core → pipes | One AIV0 pipe set | **Product target** = Card tree ([DATA-31](../context/questions/DATA.md)); stress emits it; flat CTEF uses **producer names** as-is ([DATA-35](../context/decisions/DATA.md)) |
| Instruction names on bars | Marker / busy names | Show event `name`; richer labels when future traces include them |
| ProfilerStep bands | Not in sample | Phase 2 / when args or counter tracks exist |
| Dependencies | Not in sample | Phase 2; parse when predecessor/successor args appear |
| Overview Cube/Vector series | Not in sample | **Hide** charts ([DATA-32](../context/decisions/DATA.md)) |

Writers of `.rep` files should eventually emit nested models matching the Card hierarchy. Until then, the viewer remains useful on pipe-state traces like the fixture.

---

## Fixture reference

- Container: [`data/out.rep`](../../data/out.rep)
- Unpack: `python3 data/unpack_rep.py data/out.rep /tmp/out-rep`
