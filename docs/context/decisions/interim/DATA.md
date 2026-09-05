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

**Status:** `interim` — **SUPERSEDED** 2026-09-04
**Question:** [DATA-33](../DATA.md)
**Interim:** ~~Show confirmed duration from `OpBasicInfo.csv` `Task Duration(us)`. Compute TFLOPS and avg core util tiles stay **title + `N/A`**.~~ Product (NPU-Compute): compute/util come from `summary.jsonl` `OpInfoSummary` (`aic_flops` / `aiv_flops` + theoretical; **AI Core 并行使用率**). See [DATA-33](../DATA.md), [DATA-2](../DATA.md), [DATA-9](../DATA.md).
**Implement / test as:** Compute/parallel-util cards in `StatsAside`
**Superseded when:** — already superseded by NPU-Compute.md / DATA-33.

### DATA-33b — PIPE aggregation

**Status:** `interim`
**Question:** [DATA-33](../DATA.md)
**Interim:** **Mean of non-`NA` ratios** per pipe family across `block_id`.
**Implement / test as:** `PipeOccupancyPanel` unit tests
**Superseded when:** DATA-33 / data spec overrides aggregation

### DATA-33c — Block scope vs aggregate

**Status:** `interim`
**Question:** [DATA-33](../DATA.md)
**Interim:** Summary **PIPE bars** stay DATA-33b (mean across blocks). **Detail / memory / metrics** views are **block-scoped** via the block switcher ([`v930/memory-load-detail`](../../../../docs/ui/source/v930/memory-load-detail.jpeg)). Default selected block = first `block_id` in fixture order.
**Implement / test as:** Aside detail tabs + block picker tests
**Superseded when:** Product defines block vs aggregate UX

### DATA-33d — 查看全部 CSV

**Status:** `interim`
**Question:** [DATA-33](../DATA.md)
**Interim:** Library emits `view-full-csv` with `{ fileName, text }` (or blob URL). Playground / MSTT host opens the full CSV in a **new tab** (blob URL or editor tab).
**Implement / test as:** Emit + host/playground open
**Superseded when:** Product specifies host chrome

### DATA-33e — Duration card chrome

**Status:** `interim` — **SUPERSEDED** 2026-09-04
**Question:** [DATA-33](../DATA.md)
**Interim:** ~~Bar = `min(100%, Block Dim / core_count × 100%)`.~~ Product (NPU-Compute / UI-32): **bar removed**. Secondary = `{blockDim} Blocks / {coreCount} 核` when both set; else `{blockDim} Blocks`; else `opName`. Core count still DATA-1.
**Implement / test as:** `PR-STATS-009`–`011`, `PR-STATS-031`
**Superseded when:** — already superseded by NPU-Compute.md / UI-32.

### DATA-33f — PIPE in-bar absolute

**Status:** `interim`
**Question:** [DATA-33](../DATA.md)
**Interim:** **Product confirmed (DATA-18):** `absoluteValue` = **mean of non-`NA` `*_time(us)`** for the same family/side as the ratio (DATA-33b). Omit when all NA. Not cycles.
**Implement / test as:** `PR-STATS-013`, adapter unit tests
**Superseded when:** Product changes in-bar metric

### DATA-33g — I/O bandwidth cards

**Status:** `interim` — **SUPERSEDED** 2026-09-04
**Question:** [DATA-33](../DATA.md)
**Interim:** ~~Peak/score still a guess (1600 GB/s; `round(measured/peak×100)`).~~ Product (NPU-Compute / DATA-5, DATA-6, DATA-7): measured read/write BW from `summary.jsonl` `Memory` category; peak = `OpInfoSummary.aicore_gm_bw_theoretical(GB/s)` = **SOL 1600 GB/s**; score = `measured / peak × 100%`. Fall back to `Memory.csv` mean when `summary.jsonl` is absent. Display **GB/s** (UI-34).
**Implement / test as:** `bandwidthCards`, `PR-VM-013`, `PR-STATS-024`
**Superseded when:** — already superseded by NPU-Compute.md / DATA-33.

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
