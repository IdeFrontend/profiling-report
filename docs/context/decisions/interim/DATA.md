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
**Interim:** ~~Bar = `min(100%, Block Dim / core_count × 100%)`.~~ ~~Product (NPU-Compute / UI-32): bar removed.~~ **Superseded 2026-10-26** by [DATA-33](../DATA.md): `OpInfoSummary` `communication_time` / `compute_overhead_time` / `compute_communication_overlap_time`; 计算时间 is the remainder of task duration.
**Implement / test as:** `PR-VM-026`, `PR-STATS-009`, `PR-STATS-031`
**Superseded when:** — superseded 2026-10-26.

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

**Status:** `interim` — **SUPERSEDED** 2026-10-19 by [DATA-37](../DATA.md)
**Question:** [DATA-37](../../questions/DATA.md)
**Interim:** Achieved performance = mean non-`NA` `aiv_vec_fops` / mean non-`NA` `aiv_time(us)` as `fops / timeUs / 1e6` (Cube: `aic_cube_fops` / `aic_time(us)` when Vector fops absent). Aggregate across blocks follows the one selector: `All` = the `summary.jsonl` `ArithmeticUtilization` category record, a picked `block_id` = that block's CSV row ([DATA-19](../DATA.md) / [DATA-29](../DATA.md)).
**Implement / test as:** `RooflinePanel` / adapter tests
**Superseded when:** Product-final [DATA-37](../DATA.md) (2026-10-19).

### DATA-37b — Roofline X GM (Ops/Byte)

**Status:** `interim` — **SUPERSEDED** 2026-10-19 by [DATA-37](../DATA.md)
**Question:** [DATA-37](../../questions/DATA.md)
**Interim:** Intensity = same fops / `(mean(read_main_memory_datas(KB)) + mean(write_main_memory_datas(KB))) * 1024` from `Memory.csv`. Under the one selector, `All` reads the `summary.jsonl` `Memory` category record and a picked `block_id` reads that block's `Memory.csv` row ([DATA-19](../DATA.md) / [DATA-29](../DATA.md)).
**Implement / test as:** Adapter GM point
**Superseded when:** Product-final [DATA-37](../DATA.md) (2026-10-19).

### DATA-37c — Roofline L2 series

**Status:** `interim` — **SUPERSEDED** 2026-10-19 by [DATA-37](../DATA.md)
**Question:** [DATA-37](../../questions/DATA.md)
**Interim:** **Omit** L2 point (L2Cache has hit counts only, no byte traffic).
**Implement / test as:** Legend GM-only when L2 absent
**Superseded when:** Product-final [DATA-37](../DATA.md) (2026-10-19).

### DATA-37d — Roofline roof

**Status:** `interim` — **SUPERSEDED** 2026-10-19 by [DATA-37](../DATA.md)
**Question:** [DATA-37](../../questions/DATA.md)
**Interim:** `peakComputeTops = 1`; `peakBandwidthGBs` = max of non-`NA` `aiv_main_mem_*_bw(GB/s)` / `aic_main_mem_*_bw(GB/s)` (fallback **100** if all NA) — under the one selector, from the `summary.jsonl` `Memory` category for `All` and from the block's `Memory.csv` row otherwise ([DATA-19](../DATA.md) / [DATA-29](../DATA.md)). Roof TOps/s = `min(peakCompute, peakBW_GBs * intensity / 1000)`.
**Implement / test as:** Chart roof polyline
**Superseded when:** Product-final [DATA-37](../DATA.md) (2026-10-19).

### DATA-37e — Roofline op-mix

**Status:** `interim` — **SUPERSEDED** 2026-10-19 by [DATA-37](../DATA.md)
**Question:** [DATA-37](../../questions/DATA.md)
**Interim:** Normalize non-zero Vector `aiv_vec_{fp32,fp16,int32,int16,misc}_ratio` (or Cube `aic_cube_*`) to %; show top contributors.
**Implement / test as:** Mix labels on chart
**Superseded when:** Product-final [DATA-37](../DATA.md) (2026-10-19).

### DATA-37f — Roofline tabs

**Status:** `interim` — **SUPERSEDED** 2026-10-19 by [DATA-37](../DATA.md)
**Question:** [DATA-37](../../questions/DATA.md)
**Interim:** **Hide** 内存单元 / 通路 / 搬运 until DATA-37 defines distinct series.
**Implement / test as:** Single chart chrome
**Superseded when:** Product-final [DATA-37](../DATA.md) (2026-10-19).

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
**Interim:** Treat `ArchDiagramMetrics.csv` as biprof **Architecture Diagram** fill (§11.2.3.1), not compute 内存负载 / heatmap. Build `reportModel.memoryTopology` as the **one shared VM carrier** for the **one** plated Asc chrome (**448×423** AIC + AIV × 2; [memory-topology](../../../views/memory-topology.md)). Do **not** invent a second topology model or chrome. Map plated edges and L2 plate — SSOT `ARCH_DIAGRAM_EDGE_MAP` / `ARCH_DIAGRAM_L2_PEAK_PARAM` in [`emulateMemoryTopology.ts`](../../../../src/adapters/emulateMemoryTopology.ts). Edge labels follow biprof metric mode (`bandwidth_per_operator` → `*_gbs` as `{n} GB/s`; `bandwidth_per_request` → `*_ratio` still labeled `{n} GB/s`; `number_of_requests` → `*_cnt` as integer — float noise display-rounded). Dual AIV0/AIV1 params: **sum** for gbs/cnt, **unweighted average** of the scalar `*_ratio` values when both present (CSV does not carry numerators/denominators, so this is not (Σnum)/(Σden); asymmetric AIV0/AIV1 traffic can over/under-state the corridor until Product supplies weights or raw counts):

| Slot / plate | Parameter bases (suffix by mode) |
|--------------|-----------|
| `gm-l2-read` | `hbm_to_l2_syn` |
| `gm-l2-write` | `l2_to_hbm_syn` |
| `l2-l1-read` | `aic_out_to_l1` |
| `l1-l0a` / `l1-l0b` | `aic_l1_to_l0a` / `aic_l1_to_l0b` |
| `l0a-cube` / `l0b-cube` | `aic_l0a_to_cube` / `aic_l0b_to_cube` |
| `cube-l0c` / `l0c-cube` | `aic_cube_to_l0c` / `aic_l0c_to_cube` |
| `l2-ub` | `aiv0_out_to_ub`, `aiv1_out_to_ub` — sum (gbs/cnt) / unweighted average (ratio) |
| `ub-l2` | `aiv0_ub_to_out` / `aiv1_ub_to_out` |
| `ub-vec` | `aiv0_ub_to_simd` / `aiv1_ub_to_simd` |
| `vec-ub` | `aiv0_simd_to_ub` / `aiv1_simd_to_ub` |
| L2 `peakPct` | `l2_cached_ratio` (mode-invariant) |

**Gaps (HTML Bandwidth-per-operator inventory present, not plated):** bases in `ARCH_DIAGRAM_UNPLATED_HTML_BASES` (L0C→all/OUT/UB, UB→L1, SIMT/DataCache corridors). Unit util ratios other than `l2_cached_ratio` do **not** populate UI-49 `plates` (compute badges stay PipeUtilization-only). Full tables: [memory-topology § parameter-slot-map](../../../views/memory-topology.md#parameter-slot-map).

Reuse compute edge `from`/`to` node ids from `memoryTopology.ts`. Set capability **`archDiagram`** when `hasDrawableTopology` (do **not** advertise emulate as `memoryDiagram`). Aside / overlay titles use the same **内存负载分析** / Memory load analysis (`memoryAnalysis`) and fullscreen **内存拓扑** / Memory topology as compute — still rendered by `MemoryTopologyPanel` on the shared `memoryTopology` carrier. Emulate chrome shows a metric-mode dropdown (`topology-metric-select`). The heat panel is a **separate** surface on its own `memoryHeatmap` carrier ([DATA-49](../DATA.md)) — do not read `MemoryRWAccesses` here.
**Implement / test as:** `topologyFromArchDiagramMetrics(csv, mode)`; `PR-ASIM-008` / `PR-ASIM-008b` (full map + HTML-gap drift lock + mode merge)
**Superseded when:** Product locks DATA-48 slot map and/or ships a dedicated chrome / richer `ArchDiagramModel`

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


<a id="data-53a"></a>

### DATA-53a — Emulate Source stall tooltip / SIMDStallsJson

**Status:** `interim`
**Question:** [DATA-53](../DATA.md) (resolved; deferred slice)
**Interim:** Do **not** map `AsmMetrics.SIMDStallsJson` / `SourceLineMetrics.SIMDStallsJson` into Source | SASS in this slice. Keep the SourceView stall tooltip hard-wired to compute `samplingStall` + `stallBreakdown`. Emulate MVP does **not** invent a Sampling Stall column.
**Implement / test as:** `adaptEmulateSourceCorrelation` omits stall columns; no `stallBreakdown` on emulate rows; PR-SRC-012…017
**Superseded when:** Product defines emulate stall column id(s) and tooltip schema (genericize beyond `samplingStall`)

<a id="data-53b"></a>

### DATA-53b — IPCAsmMetrics not on Source tab

**Status:** `interim`
**Question:** [DATA-53](../DATA.md) (resolved; deferred slice)
**Interim:** `IPCAsmMetrics.csv` does **not** light `'sourceTab'` and does **not** attach IPC columns to the static PC listing. Per-execution / `UNION ALL` fan-out is not 1:1 with `SourceInstructions` / `AsmMetrics` PCs.
**Implement / test as:** `hasEmulateSourcePack` rejects IPC-only packs; PR-SRC-015 / PR-ASIM-014
**Superseded when:** Product defines a PC-level IPC join (or a separate IPC surface)

<a id="data-53c"></a>

### DATA-53c — Emulate Source deferred surfaces

**Status:** `interim`
**Question:** [DATA-53](../DATA.md) (resolved; deferred slice)
**Interim:** Out of the first emulate Source slice: richer metric columns (bank conflicts, DMA, cache, live regs, branch efficiency, …), function / basic-block decorations, call-stack dock, and summary charts (`InstrTypeHist*`, pipe util hist, AiCore occupancy, …). Performance hints stay on the existing hints dock, not inside SourceView.
**Implement / test as:** MVP five columns only in `adaptEmulateSourceCorrelation`; SourceView dock remains absent (PR-SOURCE-010)
**Superseded when:** Product prioritizes a follow-on Source chrome / metric slice

<a id="data-53d"></a>

### DATA-53d — Emulate source text: sparse fragments, no auto absolute paths

**Status:** `interim`
**Question:** [DATA-53](../DATA.md) (resolved; deferred display fidelity)
**Interim:** Reconstruct editor text sparsely from `SourceLines` via `DebugInfo` only. Missing text → compute-style `MISSING_SOURCE_EMBED_PREFIX` placeholder. Gaps between mapped `DebugInfoLineNum`s are empty lines so caret / correlation line numbers stay correct — the document therefore looks **fragmented**, not a solid full file (producer `SourceLines` is not a complete snapshot). High max line numbers still pad **`text`** for Sudu, but metrics rows stay **sparse** (`lineCount` + only interesting lines) so the metrics table can virtualize without allocating tens of thousands of empty row objects. The library does **not** auto-read absolute `SourceFilePath`s from the host filesystem. Optional host `resolveMissingSourceFiles` / `resolveSourceFile` may fill placeholders later (same hook as compute). No new rule requiring full `.asc` bundles in the leaf.
**Implement / test as:** `adaptEmulateSourceCorrelation` + PR-SRC-014; `SourceFileModel.lineCount`; [SourceMetricsTable](../../../../src/ui/SourceView/SourceMetricsTable.vue) virtual window; [resolveSourceFile.ts](../../../../src/adapters/sourceCorrelation/resolveSourceFile.ts)
**Superseded when:** Product locks a full-text pack / host resolver contract (related: [DATA-52](../../questions/DATA.md))

<a id="data-53e"></a>

### DATA-53e — Emulate Instruction Ticks stay raw (no tick→ns)

**Status:** `interim`
**Question:** [DATA-53](../DATA.md) (resolved; deferred display)
**Interim:** Show `TickCount` as raw ticks in MVP. Do **not** convert via `KernelInfo.frequency_ghz` (`nanoseconds = ticks / frequency_ghz`) yet.
**Implement / test as:** `tickCount` number column; PR-SRC-012
**Superseded when:** Product wants ns/µs display and confirms frequency source / missing-frequency behavior

<a id="data-50a"></a>

### DATA-50a — Heat grid geometry + unit attribution

**Status:** ~~`interim`~~ **superseded** by [DATA-50](../DATA.md) (2026-11-02).
**Question:** [DATA-50](../DATA.md) (resolved)

<a id="data-51a"></a>

### DATA-51a — Capacity line from Layout

**Status:** ~~`interim`~~ **superseded** by [DATA-51](../DATA.md) (2026-11-02).
**Question:** [DATA-51](../DATA.md) (resolved)

<a id="data-57a"></a>

### DATA-57a — Emulate Roofline* → RooflinePanel

**Status:** `interim` — engineering stamp pending Product
**Question:** [DATA-57](../../questions/DATA.md)
**Interim:**
1. **CSV SSOT.** Prefer `RooflinePoints.csv` + `RooflineComputePeaks.csv` + `RooflineBandwidthPeaks.csv` (+ optional `RooflineMetadata.csv`). Gate on latest `AnalysisState` row `AnalysisName = roofline` with `AnalysisPassed = 1`. Missing/failed analysis → omit (DATA-30). `roofline.json` is fallback only when the four CSVs are absent; when both exist, CSVs win.
2. **Units.** Producer `PerformanceGFlops` / `PeakGFlops` are BiProf GOPS (debug HTML GOP/s). Convert to panel TOps/s via `/1000`. Intensity stays Ops/Byte. Bandwidth `PeakGBs` (GiB/s) feeds the existing roof `min(p_peak, b_peak × I / 1000)`.
3. **Roofs match HTML.** Within each `Unit`, cross-product every compute peak × every bandwidth peak for that unit (David V100 ≈ 3×3 AIV + 4×2 AIC). Memory-level order / debug labels: `SIMD-UB`→SIMD, `SIMT-UB`→SIMT, `CUBE-L0`→L0, `SIMT-OUT`→SIMT-OUT, `CUBE-OUT`→CUBE-OUT. Primary catalog bw (`SIMD-UB`) solid; others dashed (HTML `Md` index). Do **not** scale by active core counts. HTML dtype sidebar toggles are **out** of v1 (start all-on).
4. **Series ids.** Map dtypes onto the compute legend family; bandwidth variants get id suffixes (`aiv-fp16-simd`, …). AIC `tf32_hf32` → new **`aic-tf32-hf32`** (+ bw suffix). Same dtype shares color; legend label includes bw when multiple roofs share a dtype.
5. **Points.** Emit all `RooflinePoints` rows. Color/`seriesId` by execution-mode heuristic: SIMD→`aiv-fp16`, SIMT→`aiv-bp16`, CUBE→`aic-int16-fp16` (display only — not a dtype claim). Label `{shortFunctionName} - {debugLabel}`.
6. **Capability.** `adaptEmulate` sets `reportModel.roofline` and pushes `'roofline'` when points exist. Do not re-derive from ExecutedInstructions / VectorUtilizations (DATA-45).
**Implement / test as:** `rooflineFromEmulatePayloads` in [`rooflineEmulate.ts`](../../../../src/adapters/rooflineEmulate.ts); PR-ASIM-013; [roofline](../../../views/roofline.md)
**Superseded when:** Product stamps as final in [DATA.md](../DATA.md) (or withdraws)
