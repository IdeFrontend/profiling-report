# View and Chart Data Requirements

Normative **required vs optional inputs** for each Timeline surface. Missing optional data → **hide** that panel/region (not hard error). See [decisions](../context/decisions/) (DATA-30).

**MVP coding defaults:** [INTERIM_DECISIONS.md](../context/INTERIM_DECISIONS.md) — Interim ≠ Product-final.

**Related:** [METRICS_AND_TRACE.md](METRICS_AND_TRACE.md) · [COMPONENTS.md](../architecture/COMPONENTS.md) · [UX_SPEC.md](../ui/UX_SPEC.md) · [FEATURE_MATRIX.md](../ui/FEATURE_MATRIX.md)

**Legend**

| Tag | Meaning |
|-----|---------|
| **Required** | Without this, the parent view cannot render usefully (or the surface is hidden) |
| **Optional** | Surface shown only when present; otherwise hide |
| **Deferred** | Formula or producer field not yet specified — hide or show placeholders only when Product unblocks |

---

## Global open policy (DATA-30)

1. Open Timeline with **minimal** data: at least a usable `SwimlaneModel` (typically from `trace.json` or a standalone Chrome Trace `.json`).
2. Each panel/chart independently: if its inputs are missing → **hide** that UI (no empty chrome, no hard error for optional analytics).
3. Hard error only when the **source cannot be parsed at all** (corrupt container / invalid JSON).

---

## Surfaces

### 1. Timeline shell (`ProfilingReport` / Timeline tab)

| Input | Source | Requirement |
|-------|--------|-------------|
| Report bytes or prebuilt models | Host / adapter | **Required** to mount |
| `SwimlaneModel` (`processes`, `minTime`, `maxTime`) | `trace.json` inside `.rep` / `.ncrep`, or standalone Chrome Trace `.json` | **Required** for Timeline |
| `ReportViewModel` | CSV embeds via `RepAdapter` | **Optional** — Timeline works without aside analytics |
| `capabilities` | Host / adapter | **Optional** — gates P2 surfaces |

**Minimum to open Timeline:** parseable Chrome Trace → non-empty time range (lanes may be thin).

---

### 2. Time axis + playhead (`TimeAxis`)

| Input | Requirement |
|-------|-------------|
| `SwimlaneModel.minTime` / `maxTime` (ns) | **Required** |
| `SwimlaneViewState` visible window | **Required** (defaults to full range) |
| Display unit preference (ms / µs / ns) | **Optional** — configurable ([UI-40](../context/OPEN_QUESTIONS.md)); **Interim MVP:** ms / µs / ns only, default **ms**; no clock-cycle mode ([UI-40a](../context/INTERIM_DECISIONS.md)) |

---

### 3. Cube / Vector overview charts (`OverviewCharts`)

| Input | Requirement |
|-------|-------------|
| `ReportViewModel.overviewSeries[]` (`OverviewSeries` with `{ t, v }[]`) | **Required to show** |

**Product decision (DATA-32):** If no `OverviewSeries` → **hide** the chart region entirely. Do **not** invent series from `PipeUtilization` ratios.

**Interim ([DATA-32a](../context/INTERIM_DECISIONS.md)):** Adapter returns `overviewSeries: []` on current fixtures; charts stay hidden until a producer fills series.

---

### 4. Lane gutter (`LaneGutter`)

| Input | Requirement |
|-------|-------------|
| `SwimProcess` / `SwimThread` names | **Required** (from trace metadata / events / synthetic model) |
| Hierarchy Card → 通信/计算/储存HBM → `CoreN.*` → pipes | **Producer- or stress-defined nodes** (DATA-35: no viewer heuristics inventing Card/Core from flat AIV names). Nested `SwimThread.children` when present; flat CTEF remains valid |
| `SwimThread.utilization` (0..1) | **Optional** — omit mini-bars if absent; folders and leaves may both carry util |

**Target fidelity (DATA-31):** Product aims at sketch Card → Core → pipe Gantt. **Interim fixture ([DATA-31a](../context/INTERIM_DECISIONS.md)):** CI uses `data/out.rep` (flat AIV); playground stress presets emit nested Card tree for sketch fidelity. Do not fail MVP acceptance on `out.rep` pixel-parity.

---

### 5. Swimlane canvas (`SwimlaneCanvas` / events)

| Input | Requirement |
|-------|-------------|
| `SwimEvent` (`id`, `name`, `startTime`, `duration`) | **Required** (empty trace → empty lanes, still valid) |
| `args` / category for color | **Optional** — fallback palette if missing |
| `dependencies` | **Optional** — P2 links only when present (DATA-36 still open) |
| ProfilerStep bands | **Optional** — P2 / when data exists |

---

### 6. Event tooltip + detail strip

| Input | Requirement |
|-------|-------------|
| Hovered/selected `SwimEvent` name + timing | **Required** for tooltip/detail |
| Time unit for display | **Configurable** (UI-40) |
| Source paths / PC / dep mini-graph | **Optional** — P2 |

---

### 7. Report summary (`StatsSummaryPanel`)

| Metric (sketch) | Likely embeds | Requirement |
|-----------------|---------------|-------------|
| Op name / type / task duration | `OpBasicInfo.csv` | Duration card when `taskDurationUs` present — **field confirmed** `Task Duration(us)`. Bar/secondary per DATA-33e (DATA-1, UI-32). Op type is not a separate card. `opName` / `blockDim` feed duration secondary; `coreCount` from `HardwareInfo.jsonl` |
| Current / rated frequency (raw) | `OpBasicInfo.csv` | Parsed onto `currentFreq` / `ratedFreq`. **Not on the aside shell** (v930 header has no freq). Shown in the hardware overlay when OpBasicInfo is the fallback |
| Compute (e.g. 172/320 TFLOPS) | `ArithmeticUtilization` (+ peaks TBD) | **Placeholder** until DATA-33 / data spec — title + `N/A` when duration is present (do not invent values); omit when BW-only — [DATA-33a](../context/INTERIM_DECISIONS.md) |
| I/O bandwidth tiles | `Memory.csv` `ai*_main_mem_{read\|write}_bw(GB/s)` | **Measured confirmed.** Show when a side has non-`NA`; hide card if both NA. Display **GB/s** (UI-34). Peak 1600 GB/s still DATA-33g guess |
| Avg core util % | PipeUtilization / OpBasicInfo TBD | **Placeholder** until DATA-33 / data spec — title + `N/A` when duration is present (do not invent values); omit when BW-only — [DATA-33a](../context/INTERIM_DECISIONS.md) |
| Hardware one-liner (进程 / 算子类型 / Blocks) | `OpBasicInfo.csv` | **进程** ← `Pid` / `PID`; **算子类型** ← `Op Type`; **Blocks** ← `Block Dim`. Hide a segment when unset; hide the row if all empty. Never invent 核数 / NPU ARCH / aic频率 on this row |
| Hardware details panel | `HardwareInfo.jsonl` or OpBasicInfo | **Source confirmed:** jsonl categories; OpBasicInfo fallback when jsonl absent; 更多 opens it |

If no `taskDurationUs` and no `bandwidthCards` → **hide** the summary card group (PIPE may still show). Meta row is independent of summary cards (may show pid / type / blocks without cards).

---

### 8. PIPE occupancy bars (`PipeOccupancyPanel`)

| Input | Requirement |
|-------|-------------|
| `PipeOccupancyItem[]` from `PipeUtilization.csv` | **Required to show** panel |
| Aggregation | **Interim ([DATA-33b](../context/INTERIM_DECISIONS.md)):** mean of non-`NA` ratios per pipe family |
| Absolute in-bar | **Confirmed (DATA-18, [DATA-33f](../context/INTERIM_DECISIONS.md)):** mean non-`NA` `*_time(us)` for the family/side; omit when all NA |
| Scale + hatch | **Required** when panel shows — 0–100% axis; hatched remainder |
| Cube \| Vector toggle | **M1:** show control when `OpType == MIX`; otherwise show relevant side only ([`v930/compute-load`](../ui/source/v930/compute-load.jpeg)) |
| ICache Miss | **Confirmed:** `aic_icache_miss_rate` / `aiv_icache_miss_rate` when the mean is present |
| Colors | Normative sketch tokens — [COLOR_TOKENS.md](../ui/COLOR_TOKENS.md) |
| 详情 | Navigate to compute `CsvFieldListPanel` + emit `open-pipe-details` |

Missing `PipeUtilization.csv` or all-`NA` for all pipes → **hide** PIPE panel.

---

### 9. Compute-load detail tabs (`CsvFieldListPanel` / Pipe details) — M1

| Input | Requirement |
|-------|-------------|
| Tabs | `PipeUtilization`, `ArithmeticUtilization`, `ResourceConflictRatio` CSVs |
| Selected `block_id` | **Required** — [DATA-33c](../context/INTERIM_DECISIONS.md) |
| Search query | UI-only |

Hide tab when CSV missing. Show `NA` values.

---

### 10. Roofline (`RooflinePanel`) — M2

| Input | Requirement |
|-------|-------------|
| Points (intensity, achieved perf) | **Required to show** — interim DATA-37a/b GM point from ArithmeticUtilization + Memory |
| Op-mix labels (e.g. `Vec_FP32`) | Optional — DATA-37e when mix ratios present |
| Peak bandwidth / compute ceilings | Interim DATA-37d (constants + Memory BW); Product-final when DATA-37 closes |
| `ArithmeticUtilization.csv` + `Memory.csv` | Interim sources (DATA-37*) |
| L2 series / tab filters | **Omit** (DATA-37c/f) until DATA-37 |

Hide when no usable GM point. M3 swaps formulas when Product closes DATA-37.

---

### 11. Memory topology (`MemoryTopologyPanel`) — M2

| Input | Requirement |
|-------|-------------|
| Static SVG topology asset | **Required** for diagram chrome |
| Edge **labels** (BW, %, KB, …) | **Data-driven** from [VIEW_DATA_MAPPING](../ui/VIEW_DATA_MAPPING.md) §11.2.6 + selected block. **Hide `NA`; show 0.** L2↔L1 from `Memory.csv`. UB: `MemoryUB.csv` names first, then `Memory.csv` sample names |
| Edge **thicknesses** | **Not** data-driven — keep static SVG geometry |
| Memory* / L2Cache CSVs | **Required to show**; hide diagram if no label data |
| Field list mode | Optional — same CSVs as memory detail tabs |

---

### 12. Memory detail tabs — M1

| Input | Requirement |
|-------|-------------|
| Tabs | Memory L1 (`Memory.csv`), L2Cache, Memory L0, Memory UB |
| Block switcher | [DATA-33c](../context/INTERIM_DECISIONS.md) |
| 查看全部 | Emit full CSV open ([DATA-33d](../context/INTERIM_DECISIONS.md)) |

Hide tab when CSV missing.

---

### 13. Timeline time-range measure — M2

| Input | Requirement |
|-------|-------------|
| `measureMode` / `measureRange` | Toolbar + canvas overlay |
| Aside sync | **No** — local overlay only; right panel unchanged for `measureRange` |

---

### 14. Hardware details (`HardwareDetailsPanel`) — M1 interim DATA-34a

| Input | Requirement |
|-------|-------------|
| `HardwareInfo.jsonl` sections | Preferred when present |
| OpBasicInfo non-empty columns | Fallback when jsonl absent |
| Invented cores / HBM / peaks | **Never** |

Omit panel when neither source yields fields. 更多 navigates in-aside + still emits `open-hardware-details`.

---

### 15. Secondary tabs (OP / Source / Details / Cache) — P2

Data contracts still open (UI-37). Do not block Timeline MVP.

---

## Source → surface matrix (quick)

| Source | Surfaces it can feed |
|--------|----------------------|
| Chrome Trace (`trace.json` or `.json`) | Shell, axis, gutter, swimlane, tooltip/detail, measure overlay |
| `OpBasicInfo.csv` | Partial summary (identity, duration, freqs); MIX toggle gate |
| `PipeUtilization.csv` | PIPE bars; Cube/Vector sets; compute detail tab; gutter util if mapped |
| `ArithmeticUtilization.csv` | Compute detail tab; M2 roofline |
| `Memory*.csv` | Memory detail tabs; M2 topology edge labels; DATA-33g I/O bandwidth cards |
| `L2Cache.csv` | Memory detail L2Cache tab; topology hit-rate label |
| `ResourceConflictRatio.csv` | Compute detail tab |
| `OverviewSeries` (TBD producer) | Overview charts |
| Host metadata | Theme, locale, time-unit prefs; 查看全部 CSV tab; future hardware |

---

## Standalone `.json` (PROC-3)

Chrome Trace **`.json`** opens in **profiling-report** (same swimlane path as embedded `trace.json`). Aside panels stay hidden without CSV pack. **`.bin`** remains Insight.
