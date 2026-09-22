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

**Status:** `interim` — **SUPERSEDED** by [DATA-39](../DATA.md)
**Question:** [DATA-39](../DATA.md) (hide-if-empty already decided: [DATA-32](../DATA.md))
**Interim:** ~~Adapter returns `overviewSeries: []`; UI **hides** charts (aligns with Product DATA-32).~~ ~~Superseded by DATA-39a.~~ Product DATA-39: map every `Sampling.json` `ph:C` counter; still `[]` (and hide) when Sampling absent / no counters (DATA-32).
**Implement / test as:** No fake series from CSV
**Superseded when:** — already superseded by DATA-39

### DATA-39a — OverviewSeries from Sampling.json

**Status:** `interim` — **SUPERSEDED** 2026-09-08 by [DATA-39](../DATA.md)
**Question:** [DATA-39](../DATA.md)
**Interim:** ~~Producer embed = product `Sampling.json` (case variants). Emit **one** `OverviewSeries` per distinct Chrome Trace `ph:"C"` counter `name` present (`id` = `label` = `name`). Points: `{ t: ts×1e3 (µs→canonical ns), v: args.value }` for events with a finite `args.value`; points sorted by `t`; series order = first-seen name order. No embed / no `ph:C` → `[]` → hide (DATA-32). Do **not** invent from `PipeUtilization`. Do **not** rename CUBE→Cube / invent Vector or 通信 until Product maps labels.~~ Product-final: [DATA-39](../DATA.md) — render **all** counters present in `Sampling.json`.
**Implement / test as:** `overviewSeriesFromSampling` in adapter; PR-VM-003; `OverviewCharts` tracks
**Superseded when:** — already superseded by DATA-39

### DATA-33a — Summary tiles

**Status:** `interim` — **SUPERSEDED** 2026-09-04
**Question:** [DATA-33](../DATA.md)
**Interim:** ~~Show confirmed duration from `OpBasicInfo.csv` `Task Duration(us)`. Compute TFLOPS and avg core util tiles stay **title + `N/A`**.~~ Product (NPU-Compute): compute/util come from `summary.jsonl` `OpInfoSummary` (`aic_flops` / `aiv_flops` + theoretical; **AI Core 并行使用率**). See [DATA-33](../DATA.md), [DATA-2](../DATA.md), [DATA-9](../DATA.md).
**Implement / test as:** Compute/parallel-util cards in `StatsAside`
**Superseded when:** — already superseded by NPU-Compute.md / DATA-33.

### DATA-33b — PIPE aggregation

**Status:** `interim` — **SUPERSEDED** 2026-09-11
**Question:** [DATA-33](../DATA.md)
**Interim:** ~~Default **All** = **mean of non-`NA` ratios** per pipe family across `block_id`. Summary block control may scope PIPE to one `block_id`.~~ Product-confirmed ([DATA-28](../DATA.md) / [DATA-19](../DATA.md)): `All` = `summary.jsonl` non-`NA` mean across `block_id`; a picked `block_id` = that block's `PipeUtilization.csv` row.
**Implement / test as:** `StatsAside` PIPE + `pipeOccupancyFromRows`; PR-STATS-014b
**Superseded when:** — done ([DATA-28](../DATA.md)).

### DATA-33c — Block scope vs aggregate

**Status:** `interim` — **SUPERSEDED** 2026-09-11
**Question:** [DATA-33](../DATA.md)
**Interim:** ~~Summary **PIPE** defaults to DATA-33b (**All** = mean across blocks); the summary block control may scope PIPE to one `block_id`. **Detail / memory / metrics** views are **block-scoped** via the block switcher; **All** restores the default topology block.~~ Product-confirmed ([DATA-19](../DATA.md) / [DATA-29](../DATA.md)): **one** selector — **All | 0 | 1 | 2 …**, default **All** — scopes **every** CSV-backed widget; `All` reads `summary.jsonl`, a picked id reads that block's CSV row. Op-level-only metrics (`HardwareInfo`, AI Core 并行使用率 / 负载均衡度) do not change, and without `summary.jsonl` the `All` aggregate falls back to the CSV data.
**Implement / test as:** Aside detail tabs + block picker tests
**Superseded when:** — done ([DATA-29](../DATA.md)).

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
**Interim:** **Product confirmed (DATA-18):** `absoluteValue` = **mean of non-`NA` `*_time(us)`** for the same family/side as the ratio (one selector scopes it, [DATA-19](../DATA.md) / [DATA-29](../DATA.md)). Omit when all NA. Not cycles.
**Implement / test as:** `PR-STATS-013`, adapter unit tests
**Superseded when:** Product changes in-bar metric

### DATA-33g — I/O bandwidth cards

**Status:** `interim` — **SUPERSEDED** 2026-09-04
**Question:** [DATA-33](../DATA.md)
**Interim:** ~~Peak/score still a guess (1600 GB/s; `round(measured/peak×100)`).~~ Product ([DATA-8](../DATA.md), DATA-5–DATA-7): measured read / write BW = the `OpInfoSummary` sides `aicore_gm_read_bw` / `aicore_gm_write_bw` (the aic + aiv `Memory` sums), peak = `aicore_gm_bw_theoretical(GB/s)` = **SOL 1600 GB/s** (shared by both sides), score per direction = **measured ÷ peak**. Fall back to the `Memory.csv` non-`NA` mean when `summary.jsonl` is absent. Display **GB/s** (UI-34).
**Implement / test as:** `bandwidthCards`, `PR-VM-013`, `PR-STATS-024`
**Superseded when:** — already superseded by NPU-Compute.md / DATA-33.

### DATA-33h — 算力情况 card

**Status:** `interim` — **SUPERSEDED** for product `summary.jsonl` 2026-09-04; still used for classic `.rep`
**Question:** [DATA-33](../DATA.md)
**Interim:** Classic `.rep`: measured TFLOPS from ArithmeticUtilization fops/time; peak from HardwareInfo cores × freq (DATA-2..4 interim). Product `npu-rep`: prefer `OpInfoSummary` `aic_flops` / `aiv_flops` (+ theoretical) → `computeCard`.
**Implement / test as:** `computeCard`, `PR-VM-015`, `PR-STATS-032`
**Superseded when:** Product summary.jsonl present (already for npu-rep); classic `.rep` still uses this interim.

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
**Interim:** Achieved performance = mean non-`NA` `aiv_vec_fops` / mean non-`NA` `aiv_time(us)` as `fops / timeUs / 1e6` (Cube: `aic_cube_fops` / `aic_time(us)` when Vector fops absent). Aggregate across blocks follows the one selector: `All` = the `summary.jsonl` `ArithmeticUtilization` category record, a picked `block_id` = that block's CSV row ([DATA-19](../DATA.md) / [DATA-29](../DATA.md)).
**Implement / test as:** `RooflinePanel` / adapter tests
**Superseded when:** Product DATA-37 formulas

### DATA-37b — Roofline X GM (Ops/Byte)

**Status:** `interim`
**Question:** [DATA-37](../../questions/DATA.md)
**Interim:** Intensity = same fops / `(mean(read_main_memory_datas(KB)) + mean(write_main_memory_datas(KB))) * 1024` from `Memory.csv`. Under the one selector, `All` reads the `summary.jsonl` `Memory` category record and a picked `block_id` reads that block's `Memory.csv` row ([DATA-19](../DATA.md) / [DATA-29](../DATA.md)).
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
**Interim:** `peakComputeTops = 1`; `peakBandwidthGBs` = max of non-`NA` `aiv_main_mem_*_bw(GB/s)` / `aic_main_mem_*_bw(GB/s)` (fallback **100** if all NA) — under the one selector, from the `summary.jsonl` `Memory` category for `All` and from the block's `Memory.csv` row otherwise ([DATA-19](../DATA.md) / [DATA-29](../DATA.md)). Roof TOps/s = `min(peakCompute, peakBW_GBs * intensity / 1000)`.
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

### DATA-38a — Card gutter 时钟周期 quantity / formula

**Status:** `interim` — **SUPERSEDED** 2026-09-14 by [DATA-38](../DATA.md) / [UI-46](../UI.md)
**Question:** [DATA-38](../../questions/DATA.md) *(resolved — removed from open list)*
**Interim:** ~~Two dropdown modes; shared event-coverage barWidth; clockCycle labels = absolute `*_total_cycles` (derive when missing); folders sum labels; bare cycle integers.~~ Product-final: [DATA-38](../DATA.md) (formula) and [UI-46](../UI.md) (label units).
**Implement / test as:** `gutterMetrics.ts`, `PR-GMET-*`
**Superseded when:** — already superseded by DATA-38 / UI-46 (2026-09-14)

### DATA-40a — Topology edge value candidates

**Status:** `interim` — **SUPERSEDED** 2026-09-15 by [DATA-40](../DATA.md)
**Question:** [DATA-40](../../questions/DATA.md) *(resolved — removed from open list)*
**Interim:** ~~When an edge lists several candidate columns, the **first present non-`NA` candidate in the listed order wins** (`Memory.csv` `aic_main_mem_read_bw(GB/s)` then `aiv_main_mem_read_bw(GB/s)` for GM → L2, and the same shape for GM ← L2) — i.e. a single side, **not** the aic + aiv sum the BW card uses ([DATA-8](../DATA.md)). Values follow the one selector like every other CSV-backed widget: `All` = the `summary.jsonl` category record, a picked `block_id` = that block's CSV row ([DATA-19](../DATA.md) / [DATA-29](../DATA.md)).~~ Product [DATA-40](../DATA.md): the GM ↔ L2 plates are the producer's **Main Read** / **Main Write** = the aic + aiv sides **summed**; every other edge keeps first-present-non-`NA`.
**Implement / test as:** `EDGE_MAP` in [`memoryTopology.ts`](../../../../src/adapters/memoryTopology.ts) (`aggregate: 'sum'` on the two GM↔L2 sources); edge table in [memory-topology](../../../views/memory-topology.md#edge-field-source)
**Superseded when:** — already superseded by DATA-40

### DATA-47a — Emulate KernelInfo → summary cards

**Status:** `interim` — **SUPERSEDED** 2026-09-18 by [DATA-47](../DATA.md)
**Question:** [DATA-47](../DATA.md) *(resolved — removed from open list)*
**Interim:** ~~Map when present: `KernelInfo.csv` rows `KernelInfoAttr`/`KernelInfoVal` with attrs matching `op name` / `kernel name` / `name` → `summary.opName`; `op type` / `type` → `opType`; `task duration(us)` / `duration(us)` / `duration` → `taskDurationUs`; `pid` → `pid`; `block dim` → `blockDim`. Unmapped → omit field (hide card chrome via DATA-30). Do **not** invent FLOPS/BW cards from emulate.~~ Product-final: [DATA-47](../DATA.md) — emulate does **not** map KernelInfo into summary cards or the meta/更多 header; `summary` stays empty and `profile: 'emulate'`.
**Implement / test as:** ~~`summaryFromKernelInfo` in `adaptEmulate`; `PR-ASIM-003` + summary assertions~~ `profile: 'emulate'`; empty `summary`; PR-ASIM-005; PR-STATS-007
**Superseded when:** — already superseded by DATA-47


### DATA-48a — Emulate ArchDiagramMetrics → Architecture Diagram slots (interim chrome)

**Status:** `interim`
**Question:** [DATA-48](../../questions/DATA.md)
**Interim:** Treat `ArchDiagramMetrics.csv` as biprof **Architecture Diagram** fill (§11.2.3.1), not compute 内存负载 / heatmap. Build `reportModel.memoryTopology` as the **interim VM carrier** for plated Asc chrome ([arch-diagram](../../../views/arch-diagram.md)). Map plated edges (GB/s labels `{n} GB/s`) and L2 plate (SSOT: [arch-diagram § parameter-slot-map](../../../views/arch-diagram.md#parameter-slot-map)):

| Slot / plate | Parameter |
|--------------|-----------|
| `gm-l2-read` | `hbm_to_l2_syn_gbs` |
| `gm-l2-write` | `l2_to_hbm_syn_gbs` |
| `l2-l1-read` | `aic_out_to_l1_gbs` |
| `l1-l0a` / `l1-l0b` | `aic_l1_to_l0a_gbs` / `aic_l1_to_l0b_gbs` |
| `l0a-cube` / `l0b-cube` | `aic_l0a_to_cube_gbs` / `aic_l0b_to_cube_gbs` |
| `cube-l0c` / `l0c-cube` | `aic_cube_to_l0c_gbs` / `aic_l0c_to_cube_gbs` |
| `l2-ub` | `aiv0_out_to_ub_gbs` (AIV0), `aiv1_out_to_ub_gbs` (AIV1) — average when both present |
| `ub-l2` | `aiv0_ub_to_out_gbs` / `aiv1_ub_to_out_gbs` |
| `ub-vec` | `aiv0_ub_to_simd_gbs` / `aiv1_ub_to_simd_gbs` |
| `vec-ub` | `aiv0_simd_to_ub_gbs` / `aiv1_simd_to_ub_gbs` |
| L2 `peakPct` | `l2_cached_ratio` |

Reuse compute edge `from`/`to` node ids from `memoryTopology.ts`. Set capability **`archDiagram`** when `hasDrawableTopology` (do **not** advertise emulate as `memoryDiagram`). Aside / overlay titles use the same **内存负载分析** / Memory load analysis (`memoryAnalysis`) and fullscreen **内存拓扑** / Memory topology as compute — still rendered by `MemoryTopologyPanel` on the interim `memoryTopology` carrier. Do **not** use `MemoryRWAccesses` (heatmap — [DATA-49](../../questions/DATA.md)).
**Implement / test as:** `topologyFromArchDiagramMetrics` in `adaptEmulate`; `PR-ASIM-008` + `archDiagram` assertions
**Superseded when:** Product locks DATA-48 slot map and/or DATA-49 dedicated chrome/model

<a id="data-45"></a>

### DATA-45 — Do not invent compute CSVs from emulate

**Status:** `interim` — engineering stamp pending Product
**Question:** May the viewer or packer invent hardware-shaped metric CSVs (`OpBasicInfo`, `PipeUtilization`, `Memory*.csv`, …) from npu_emulate contract tables?
**Interim:** **No.** Do not silently remap simulator tables into hardware embed schemas. Each profile keeps its own sources; adapters map into shared `SwimlaneModel` / `ReportViewModel` / `capabilities[]`. Missing adapted fields → hide panels ([DATA-30](../DATA.md)).
**Implement / test as:** `adaptEmulate` / PR-ASIM-004; [emulate/FORMAT](../../../formats/emulate/FORMAT.md); [ADAPTERS](../../../formats/ADAPTERS.md)
**Superseded when:** Product stamps as final in [DATA.md](../DATA.md) (or withdraws)

<a id="data-46"></a>

### DATA-46 — Emulate PipeTrace time unit is µs

**Status:** `interim` — engineering stamp pending Product
**Question:** What time unit must an emulate leaf use in `PipeTrace.json` / native tracing report?
**Interim:** Producer **MUST** convert simulator **ticks → microseconds** when packing timeline JSON. The viewer keeps the product rule: Trace timestamps/durations are **µs** (same as hardware `PipeTrace.json`). The viewer MUST NOT reinterpret Trace as ticks, and MUST ignore misleading `displayTimeUnit: "ns"` on emulate packs.
**Implement / test as:** `adaptEmulate` `sourceTimeUnit: 'us'`; PR-SIM-003 (incl. displayTimeUnit override coverage)
**Superseded when:** Product stamps as final in [DATA.md](../DATA.md) (or withdraws)

