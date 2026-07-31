# View and Chart Data Requirements

Normative **required vs optional inputs** for each Timeline surface. Missing optional data → **hide** that panel/region (not hard error). See [OPEN_QUESTIONS](../../context/OPEN_QUESTIONS.md) (Q3 Resolved).

**MVP coding defaults:** [INTERIM_DECISIONS.md](../../context/INTERIM_DECISIONS.md) — Interim ≠ Product-final.

**Related:** [METRICS_AND_TRACE.md](METRICS_AND_TRACE.md) · [COMPONENTS.md](../architecture/COMPONENTS.md) · [UX_SPEC.md](../ui/UX_SPEC.md) · [FEATURE_MATRIX.md](../ui/FEATURE_MATRIX.md)

**Legend**

| Tag | Meaning |
|-----|---------|
| **Required** | Without this, the parent view cannot render usefully (or the surface is hidden) |
| **Optional** | Surface shown only when present; otherwise hide |
| **Deferred** | Formula or producer field not yet specified — hide or show placeholders only when Product unblocks |

---

## Global open policy (Q3)

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
| Display unit preference (ms / µs / ns) | **Optional** — configurable ([Q14](../../context/OPEN_QUESTIONS.md)); **Interim MVP:** ms / µs / ns only, default **ms**; no clock-cycle mode ([I-Q14](../../context/INTERIM_DECISIONS.md)) |

---

### 3. Cube / Vector overview charts (`OverviewCharts`)

| Input | Requirement |
|-------|-------------|
| `ReportViewModel.overviewSeries[]` (`OverviewSeries` with `{ t, v }[]`) | **Required to show** |

**Product decision (Q5 Resolved):** If no `OverviewSeries` → **hide** the chart region entirely. Do **not** invent series from `PipeUtilization` ratios.

**Interim ([I-Q5+](../../context/INTERIM_DECISIONS.md)):** Adapter returns `overviewSeries: []` on current fixtures; charts stay hidden until a producer fills series.

---

### 4. Lane gutter (`LaneGutter`)

| Input | Requirement |
|-------|-------------|
| `SwimProcess` / `SwimThread` names | **Required** (from trace metadata / events) |
| Hierarchy `CoreN.Cube` / pipe children | **Producer-defined names** for now (Q8 Resolved: fixed naming, no viewer heuristics) |
| `SwimThread.utilization` (0..1) | **Optional** — omit mini-bars if absent |

**Target fidelity (Q4):** Product aims at sketch-like multi-core instruction lanes. **Interim fixture ([I-Q4](../../context/INTERIM_DECISIONS.md)):** CI and playground use `data/out.rep`; render available lanes; do not fail MVP acceptance on sketch pixel-parity.

---

### 5. Swimlane canvas (`SwimlaneCanvas` / events)

| Input | Requirement |
|-------|-------------|
| `SwimEvent` (`id`, `name`, `startTime`, `duration`) | **Required** (empty trace → empty lanes, still valid) |
| `args` / category for color | **Optional** — fallback palette if missing |
| `dependencies` | **Optional** — P2 links only when present (Q9 still open) |
| ProfilerStep bands | **Optional** — P2 / when data exists |

---

### 6. Event tooltip + detail strip

| Input | Requirement |
|-------|-------------|
| Hovered/selected `SwimEvent` name + timing | **Required** for tooltip/detail |
| Time unit for display | **Configurable** (Q14) |
| Source paths / PC / dep mini-graph | **Optional** — P2 |

---

### 7. Report summary (`StatsSummaryPanel`)

| Metric (sketch) | Likely embeds | Requirement |
|-----------------|---------------|-------------|
| Op name / type / task duration | `OpBasicInfo.csv` | **Interim MVP ([I-Q6a](../../context/INTERIM_DECISIONS.md)):** show when columns present |
| Current / rated frequency (raw) | `OpBasicInfo.csv` | **Optional** — show as labeled raw values if present; no derived tiles |
| Compute (e.g. 172/320 TFLOPS) | `ArithmeticUtilization` (+ peaks TBD) | **Hide** until Q6 / data spec |
| I/O bandwidth tiles | `Memory.csv` / OpBasicInfo TBD | **Hide** until Q6 / data spec |
| Avg core util % | PipeUtilization / OpBasicInfo TBD | **Hide** until Q6 / data spec |
| Hardware one-liner (cores, freq) | OpBasicInfo / host | **Optional** raw; full hardware aside **out of MVP (Q7)** |

If no showable OpBasicInfo fields → **hide** the summary card group (PIPE may still show).

---

### 8. PIPE occupancy bars (`PipeOccupancyPanel`)

| Input | Requirement |
|-------|-------------|
| `PipeOccupancyItem[]` from `PipeUtilization.csv` | **Required to show** panel |
| Aggregation | **Interim ([I-Q6b](../../context/INTERIM_DECISIONS.md)):** mean of non-`NA` ratios per pipe family |
| Colors | Normative sketch tokens — [COLOR_TOKENS.md](../ui/COLOR_TOKENS.md) |

Missing `PipeUtilization.csv` or all-`NA` for all pipes → **hide** PIPE panel.

---

### 9. PIPE field list (`PipeDetailsPanel`) — P2

| Input | Requirement |
|-------|-------------|
| Raw `PipeUtilization.csv` rows/columns | **Required to show** |
| Search query | UI-only |

---

### 10. Roofline (`RooflinePanel`) — P2

| Input | Requirement |
|-------|-------------|
| Points (intensity, achieved perf, labels e.g. `Vec_FP32`) | **Required to show** — formulas still open (Q11) |
| Peak bandwidth / compute ceilings | **Required** for roof lines |
| `ArithmeticUtilization.csv` (+ Memory?) | Expected source once Q11 resolved |

Hide until formulas and data exist.

---

### 11. Memory topology (`MemoryTopologyPanel`) — P2

| Input | Requirement |
|-------|-------------|
| Static SVG topology asset | **Required** for diagram chrome |
| Edge **labels** (BW, %, KB, …) | **Data-driven** from `Memory.csv` / `MemoryL0.csv` / `MemoryUB.csv` (Q12 Resolved) |
| Edge **thicknesses** | **Not** data-driven for now — keep static SVG geometry |
| Field list mode | Optional detail list from same CSVs |

Missing memory CSVs → hide panel (or show SVG without labels only if Product prefers — default **hide** when no label data).

---

### 12. Hardware details (`HardwareDetailsPanel`) — out of MVP (Q7)

| Input | Requirement |
|-------|-------------|
| Host CPU, NPU chip, HBM, core counts | **Out of MVP** until further product/spec docs |

---

### 13. Secondary tabs (OP / Source / Details / Cache) — P2

Data contracts still open (Q10). Do not block Timeline MVP.

---

## Source → surface matrix (quick)

| Source | Surfaces it can feed |
|--------|----------------------|
| Chrome Trace (`trace.json` or `.json`) | Shell, axis, gutter, swimlane, tooltip/detail |
| `OpBasicInfo.csv` | Partial summary (identity, duration, freqs) |
| `PipeUtilization.csv` | PIPE bars; gutter util if mapped; P2 field list |
| `ArithmeticUtilization.csv` | Deferred summary compute; P2 roofline |
| `Memory*.csv` | Deferred BW tiles; P2 memory labels |
| `L2Cache.csv` | P2 Cache tab |
| `OverviewSeries` (TBD producer) | Overview charts |
| Host metadata | Theme, locale, time-unit prefs; future hardware |

---

## Standalone `.json` (Q15 Resolved)

Chrome Trace **`.json`** opens in **profiling-report** (same swimlane path as embedded `trace.json`). Aside panels stay hidden without CSV pack. **`.bin`** remains Insight.
