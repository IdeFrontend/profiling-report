# Interim DATA rules

Provisional engineering defaults for **DATA** questions — **not Product-final**. Each rule derives a sub-letter id from its question id and carries what to build now and when to throw the guess away.

Meta-rules, MVP scope checklist, and related specs: [README.md](README.md).

### DATA-31a — Golden fixture

**Status:** `interim`
**Question:** [DATA-31](../../questions/DATA.md)
**Interim:** Primary CI fixture = [`data/out.rep`](../../../../data/out.rep) (flat AIV). Acceptance = parse + render + hide rules — **not** sketch pixel-parity. Playground stress `small`/`medium`/`large` emit nested Card → Core → pipe `SwimlaneModel` for sketch hierarchy.
**Implement / test as:** e2e `PR-E2E-001` on `out.rep`; stress unit tests for Card tree
**Superseded when:** Sketch-faithful production golden arrives (Product DATA-31 target)

### DATA-32a — Overview series

**Status:** `interim`
**Question:** [DATA-32](../DATA.md)
**Interim:** Adapter returns `overviewSeries: []`; UI **hides** charts (aligns with Product DATA-32).
**Implement / test as:** No fake series from CSV
**Superseded when:** Producer defines `OverviewSeries` source

### DATA-33a — Summary tiles

**Status:** `interim`
**Question:** [DATA-33](../../questions/DATA.md)
**Interim:** Show **confirmed** duration from `OpBasicInfo.csv` `Task Duration(us)`. When duration is present, compute TFLOPS and avg core util tiles stay in the sketch grid as **title + `N/A`** (do not bind guessed values); omit those placeholders when the summary is BW-only so the grid stays rectangular. Duration uses sketch card chrome (bar still DATA-33e). Op type is **not** a separate card. I/O BW → **DATA-33g**.
**Implement / test as:** Thin duration card + N/A placeholders in `StatsAside`
**Superseded when:** Data/format spec defines compute / avg-util formulas (DATA-33)

### DATA-33b — PIPE aggregation

**Status:** `interim`
**Question:** [DATA-33](../../questions/DATA.md)
**Interim:** **Mean of non-`NA` ratios** per pipe family across `block_id`.
**Implement / test as:** `PipeOccupancyPanel` unit tests
**Superseded when:** DATA-33 / data spec overrides aggregation

### DATA-33c — Block scope vs aggregate

**Status:** `interim`
**Question:** [DATA-33](../../questions/DATA.md)
**Interim:** Summary **PIPE bars** stay DATA-33b (mean across blocks). **Detail / memory / metrics** views are **block-scoped** via the block switcher ([`v930/memory-load-detail`](../../../../docs/ui/source/v930/memory-load-detail.jpeg)). Default selected block = first `block_id` in fixture order.
**Implement / test as:** Aside detail tabs + block picker tests
**Superseded when:** Product defines block vs aggregate UX

### DATA-33d — 查看全部 CSV

**Status:** `interim`
**Question:** [DATA-33](../../questions/DATA.md)
**Interim:** Library emits `view-full-csv` with `{ fileName, text }` (or blob URL). Playground / MSTT host opens the full CSV in a **new tab** (blob URL or editor tab).
**Implement / test as:** Emit + host/playground open
**Superseded when:** Product specifies host chrome

### DATA-33e — Duration card chrome

**Status:** `interim`
**Question:** [DATA-33](../../questions/DATA.md)
**Interim:** **Product confirmed (DATA-1 + UI-32):** `summary.coreCount` from `HardwareInfo.jsonl` by `Op Type` (cube → `ai_cube_count`/`aic_cube_count`; vector → `ai_vector_count`/`aic_vector_count`; mix → `ai_core_count`). Secondary: `{blockDim} / {coreCount}` iterations/core when both set; else `blockDim` only; else `opName`. Bar = `min(100%, Block Dim / core_count × 100%)` when `coreCount` present; else decorative ~15% fill.
**Implement / test as:** `PR-STATS-009`–`011`, `PR-STATS-031`
**Superseded when:** Product changes duration-bar formula

### DATA-33f — PIPE in-bar absolute

**Status:** `interim`
**Question:** [DATA-33](../../questions/DATA.md)
**Interim:** **Product confirmed (DATA-18):** `absoluteValue` = **mean of non-`NA` `*_time(us)`** for the same family/side as the ratio (DATA-33b). Omit when all NA. Not cycles.
**Implement / test as:** `PR-STATS-013`, adapter unit tests
**Superseded when:** Product changes in-bar metric

### DATA-33g — I/O bandwidth cards

**Status:** `interim`
**Question:** [DATA-33](../../questions/DATA.md)
**Interim:** **Measured (confirmed):** mean of non-`NA` `aic_main_mem_{read|write}_bw(GB/s)` / `aiv_*` on `Memory.csv` (first matching header only; also accept headers without `(GB/s)`). **Peak (still guess):** **1600 GB/s** for all four aic/aiv × in/out slots — **not** max of measured columns. **Score (still guess):** `round(measured/peak×100)` clamped 0–100 (sketch dummy 81 ≠ ratio). **Bar:** fill = score % of track (8px pill). **Display:** **GB/s** (UI-34; magnitude rounding). **Layout:** same raised card chrome as duration; aic | aiv columns; sketch **3+2 grid** with duration. **NA side:** omit that aic/aiv column; omit card if both NA. `Report.csv` unused (no schema).
**Implement / test as:** `bandwidthCards`, `PR-VM-013`, `PR-STATS-024`
**Superseded when:** Product peak source, score formula vs sketch 81, aggregation, `Report.csv`

### DATA-38a — Card gutter 时钟周期 quantity / formula

**Status:** `interim`
**Question:** [DATA-38](../../questions/DATA.md)
**Interim:** **Not** cycle counts and **not** a mean over swimlane events. Raw = mean of non-`NA` mapped `PipeUtilization.csv` `*_time(us)` across `block_id` (DATA-33b pattern; same quantity family as DATA-33f), keyed by `laneColorKey(thread.name)` per the column map in [gutter-metrics.spec.md](../../../../specs/core/gutter-metrics.spec.md). Folders = mean of child raws. Bar width = \((\mathrm{raw}/\max)\times 100\) within the Card; red = max lane only. Dropdown offers only **clockCycle** + **utilization** (`cacheHit` / `task` withdrawn). Ignore `*_total_cycles`. **Why not PyPTO sum-of-cycles:** PyPTO joins `tilefwk_prof_pmu.csv` → `event.pmu_info['total cycle']` then sums per thread; that input is missing from NPU-Compute embeds and scanned `.npu-rep` / PR #74 fixtures (event-level PMU absent, not merely undocumented).
**Implement / test as:** `gutterMetrics.ts`, `PR-GMET-*`
**Superseded when:** Product confirms quantity (µs vs cycles), column map, or event-based / PMU formula ([DATA-38](../../questions/DATA.md)) — and producer ships the required join data

### DATA-34a — Hardware details panel

**Status:** `interim`
**Question:** [DATA-34](../DATA.md)
**Interim:** **Source confirmed:** `HardwareInfo.jsonl` category sections. Fallback: flat **OpBasicInfo** non-empty columns when jsonl absent. Never invent cores/HBM/peaks. **更多** always opens the overlay (UI-30, UI-31): show `HardwareDetailsPanel` when data exists, else **缺少 hardware info**. Aside meta is **进程** / **算子类型** / **Blocks**, not 核数 / NPU ARCH.
**Implement / test as:** `HardwareDetailsPanel`, adapter tests
**Superseded when:** Product changes HardwareInfo overlay source

### DATA-36a — Dependency encoding

**Status:** `interim`
**Question:** [DATA-36](../../questions/DATA.md)
**Interim:** Chrome Trace `args` convention: `args.event_id` makes an X event addressable (else the adapter's own `e-<seq>` id stands) and `args.dependencies` lists **successor** ids. Predecessors come from a reverse index, never from the producer. Ids that no event carries are dropped. `dependencies` capability + every dependency surface hide when the model has no edges.
**Implement / test as:** `buildDependencyGraph` / `neighborsOf` (`PR-DEPGRAPH-*`), `DetailRelevant` (`PR-DREL-*`), playground `deps` fixture
**Superseded when:** Product defines the real producer encoding (DATA-36)

### DATA-37a — Roofline Y (TOps/s)

**Status:** `interim`
**Question:** [DATA-37](../../questions/DATA.md)
**Interim:** Achieved performance = mean non-`NA` `aiv_vec_fops` / mean non-`NA` `aiv_time(us)` as `fops / timeUs / 1e6` (Cube: `aic_cube_fops` / `aic_time(us)` when Vector fops absent). Aggregate across blocks like DATA-33b.
**Implement / test as:** `RooflinePanel` / adapter tests
**Superseded when:** Product DATA-37 formulas

### DATA-37b — Roofline X GM (Ops/Byte)

**Status:** `interim`
**Question:** [DATA-37](../../questions/DATA.md)
**Interim:** Intensity = same fops / `(mean(read_main_memory_datas(KB)) + mean(write_main_memory_datas(KB))) * 1024` from `Memory.csv`.
**Implement / test as:** Adapter GM point
**Superseded when:** Product DATA-37

### DATA-37c — Roofline L2 series

**Status:** `interim`
**Question:** [DATA-37](../../questions/DATA.md)
**Interim:** **Omit** L2 point (L2Cache has hit counts only, no byte traffic).
**Implement / test as:** Legend GM-only when L2 absent
**Superseded when:** Product supplies L2 bytes

### DATA-37d — Roofline roof

**Status:** `interim`
**Question:** [DATA-37](../../questions/DATA.md)
**Interim:** `peakComputeTops = 1`; `peakBandwidthGBs` = max of non-`NA` `aiv_main_mem_*_bw(GB/s)` / `aic_main_mem_*_bw(GB/s)` (fallback **100** if all NA). Roof TOps/s = `min(peakCompute, peakBW_GBs * intensity / 1000)`.
**Implement / test as:** Chart roof polyline
**Superseded when:** Product peak sources

### DATA-37e — Roofline op-mix

**Status:** `interim`
**Question:** [DATA-37](../../questions/DATA.md)
**Interim:** Normalize non-zero Vector `aiv_vec_{fp32,fp16,int32,int16,misc}_ratio` (or Cube `aic_cube_*`) to %; show top contributors.
**Implement / test as:** Mix labels on chart
**Superseded when:** Product mix definition

### DATA-37f — Roofline tabs

**Status:** `interim`
**Question:** [DATA-37](../../questions/DATA.md)
**Interim:** **Hide** 内存单元 / 通路 / 搬运 until DATA-37 defines distinct series.
**Implement / test as:** Single chart chrome
**Superseded when:** Product tab semantics
