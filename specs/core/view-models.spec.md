# View Models

| spec-id-prefix |
|----------------|
| PR-VM-*        |

Adapt parsed `.rep` container data into canonical `ReportViewModel` and `SwimlaneModel` consumable by the UI layer.

```ts
adaptRep(parsed: ParsedRep): AdaptedReport  // { swimlaneModel, reportModel, capabilities }
```

## Behavior

**Report summary.** Extracts op identity from `OpBasicInfo.csv` (classic `.rep`) or `Summary.jsonl` `OpInfoSummary` (product `npu-rep`): op name, op type, task duration (**confirmed** `Task Duration(us)`), `pid` from `Pid` / `PID`, `blockDim` from `Block Dim`, `coreCount` from `HardwareInfo.jsonl` by op type (DATA-1; spaced keys `ai core count` etc. normalized). Product reports additionally carry derived fields from `OpInfoSummary`: `aicFlops` / `aivFlops` / `aicFlopsTheoretical` / `aivFlopsTheoretical` (compute), `gmBwTheoreticalGBs` / `gmReadBw` / `gmWriteBw` / `gmBwUsageRate` (bandwidth), and `parallelUtilization` / `parallelBalance` (AI Core 并行使用率).

**I/O bandwidth.** Read / write come from `summary.jsonl` **`OpInfoSummary`**, whose `aicore_gm_read_bw(GB/s)` / `aicore_gm_write_bw(GB/s)` are the producer's already-**summed** aic + aiv sides; peak is `OpInfoSummary.aicore_gm_bw_theoretical(GB/s)` (SOL 1600) (DATA-8). The card does **not** use `aicore_gm_bw_usage_rate(%)`; each direction's score is measured ÷ peak. Fallbacks, in order: the `category: Memory` per-side columns (`aic_main_mem_read_bw` + `aiv_main_mem_read_bw`, likewise write); then `Memory.csv` mean of non-`NA` `aic/aiv_main_mem_{read|write}_bw(GB/s)` per block when `summary.jsonl` is absent (peak 1600 GB/s). UI displays **GB/s** (UI-34). Omit a side when all-NA; omit the card when both sides NA.

**Compute power.** Prefer Product `summary.jsonl` `aic_flops`/`aiv_flops` (+ theoretical) mapped into `computeCard` (UI-33, DATA-4). Classic `.rep` without those fields uses interim ArithmeticUtilization + HardwareInfo peaks (`computeCard`, DATA-33h). N/A when neither yields a side.

**Block scope (DATA-19 / DATA-28 / DATA-29).** One selector scopes every CSV-backed widget: `All` reads the `summary.jsonl` category mean (the producer's own non-`NA` aggregate across `block_id`), a picked id reads that block's CSV row. Applies to PIPE (`PipeUtilization`), the memory topology (`Memory` / `MemoryL0` / `MemoryUB` / `L2Cache`), the roofline (`ArithmeticUtilization` + `Memory` categories, else the CSV means), the BW cards (`Memory.csv` row sides summed per DATA-8), the compute card (`ArithmeticUtilization.csv` row measured, chip-level peak) and the 详情 field lists. A picked id never renders the `All` aggregate under its own label: a widget with no data for that id yields an empty/omitted model. `HardwareInfo` and `OpInfoSummary`-only metrics (AI Core 并行使用率 / 负载均衡度) have no per-block source and stay op-level. When `summary.jsonl` is absent the `All` aggregate does not exist, so PIPE, the roofline and the memory diagram fall back to the CSV data (the classic `.rep` path).

**Summary merge.** When both `OpBasicInfo.csv` and `Summary.jsonl` exist, identity/freq come from OpBasicInfo and derived FLOPS / GM BW / parallel util overlay from `OpInfoSummary` (do not drop jsonl metrics).

**Aside meta (shell).** v930 header is **进程** / **算子类型** / **Blocks** from `pid`, `opType`, `blockDim`. Hide a segment when unset; hide the row when all three are empty. Do **not** put 核数, aic频率, or NPU ARCH on this row. `currentFreq` / `ratedFreq` stay on the model for the hardware overlay fallback; they are not shell fields. Overlay `chip_info` / `arch_info` stay in `hardwareDetails`.

**Pipe occupancy.** Reads `summary.jsonl` `category: PipeUtilization` for the `All` scope, or one `block_id`'s rows from `PipeUtilization.csv`, computing per-pipe-family means of non-NA ratios (DATA-19 / DATA-28 / DATA-29). Optional `absoluteValue` = mean non-NA matching `*_time(us)` (DATA-33f). **ICache Miss confirmed:** include when `*_icache_miss_rate` mean is present. Each item is **side-specific**: Cube uses `aic_*` columns, Vector uses `aiv_*`. Shared family names (MTE2, Scalar) appear as separate cube/vector items — never a blended AIC+AIV mean. Ratios merge into matching swimlane threads by `laneColorKey` (mean when both sides contribute the same key).

**CSV detail tables (M1).** Builds `CsvTableModel` entries for compute tabs (`PipeUtilization`, `ArithmeticUtilization`, `ResourceConflictRatio`) and memory tabs (`Memory.csv`, `L2Cache`, `MemoryL0`, `MemoryUB`). Each table includes headers, rows, and distinct `blockIds` in fixture order (DATA-19 / DATA-29). Missing embeds are omitted. Raw CSV text is stored in `csvTexts[fileName]` for 查看全部 (DATA-33d).

**Swimlane model.** Extracts the timeline via `chromeTraceToSwimlane`: `trace.json` with `sourceTimeUnit: 'ns'` (classic `.rep`), or `PipeTrace.json` with `sourceTimeUnit: 'us'` (product `npu-rep`; its `displayTimeUnit: "ns"` label is misleading — ts/dur are microseconds).

**Overview series.** From product `Sampling.json` Chrome Trace `ph:"C"` counters ([DATA-39](../context/decisions/DATA.md)): one `OverviewSeries` per distinct counter `name` present (`id`/`label` = `name`); `points[{t,v}]` from `ts` (µs→canonical ns) and finite `args.value`. Empty when Sampling absent or no counters — hide UI ([DATA-32](../context/decisions/DATA.md)). Do not invent from `PipeUtilization`.

**Chrome Trace–only loads.** `emptyReportViewModel()` / `adaptChromeTrace` leave compute/memory tables and `csvTexts` empty (PROC-3).

**Summary detail categories (product).** When `summary.jsonl` is present, build `summaryCategories` from its metric category lines (block-mean, per spec "默认显示 summary.jsonl 分组数据"), excluding `OpInfoSummary`. The detail surface renders these as the **All** default, falling back to raw CSV tables + block switcher otherwise; a picked `block_id` replaces the category list with that block's CSV row (DATA-19 / DATA-29).

**Roofline (M2 interim DATA-37*).** When the `summary.jsonl` `ArithmeticUtilization` + `Memory` categories (the **All** scope), or else `ArithmeticUtilization.csv` + `Memory.csv` (classic `.rep`), yield a GM point: set `reportModel.roofline` and include `'roofline'` in `capabilities`. Omit `roofline` (and the capability) when undecidable. L2 omitted (DATA-37c). Tabs omitted (DATA-37f).

**Hardware details (M1).** Prefer `HardwareInfo.jsonl` category sections (product source); else OpBasicInfo non-empty columns. Omit when neither yields fields. Include `'hardwareDetails'` in capabilities when model present. **StatsAside** always shows **更多** on the report shell; when the adapter omits `hardwareDetails`, the overlay shows **缺少 hardware info** (UI-30, UI-31). Do **not** map jsonl `ai_core_count` / `chip_info` onto the aside meta row.

**Memory topology (M2, change-log #5).** Build `reportModel.memoryTopology` from the `summary.jsonl` `All` category records (DATA-19 / DATA-29), falling back to the first labelled block's Memory* CSV row when `summary.jsonl` is absent, per [VIEW_DATA_MAPPING §11.2.6](../ui/VIEW_DATA_MAPPING.md). L2↔L1 from `Memory.csv`. UB→L2 / L2→UB: `Memory.csv` `aiv_ub_to_gm_bw(GB/s)` / `aiv_gm_to_ub_bw(GB/s)` ([DATA-22](../context/decisions/DATA.md) / [DATA-23](../context/decisions/DATA.md)) — the producer does **not** emit the `MemoryUB.csv` `*_gm` names. L0C → L1 / L0C → L2/GM: `Memory.csv` `L0C_to_L1_datas(KB)` / `L0C_to_GM_datas(KB)` ([DATA-24](../context/decisions/DATA.md) / [DATA-25](../context/decisions/DATA.md)); their 理论值 (Peak %) stays open with [DATA-20](../context/questions/DATA.md). L0C → UB and remote arrows are not drawn ([DATA-26](../context/decisions/DATA.md) / [DATA-27](../context/decisions/DATA.md)). `buildMemoryTopology(tables, blockId)` rebuilds labels for another block; every widget shares the one block selector ([DATA-19](../context/decisions/DATA.md) / [DATA-29](../context/decisions/DATA.md)). Hide `NA` labels; **show 0**. Omit `memoryTopology` (and `'memoryDiagram'`) when no edge yields a label. **L2 Peak(%) (DATA-20):** set `nodes` entry `l2.peakPct` from the same L2Cache hit-rate value as the `l2-hit` edge (DATA-21 column order: first non-`NA` of `aic_total_hit_rate(%)`, `aiv_total_hit_rate(%)`, `aic_read_hit_rate(%)`, `aiv_read_hit_rate(%)`).

## Acceptance Criteria

1. **PR-VM-001** — ReportViewModel.summary contains name, type, duration, pid, blockDim, optional coreCount (DATA-1). Classic `.rep` leaves compute/util unset (no `summary.jsonl`). Product `npu-rep` fills `aicFlops` / `parallelUtilization` from `OpInfoSummary` (DATA-2, DATA-9, DATA-33).
2. **PR-VM-002** — PipeOccupancy aggregates mean of non-NA ratios per pipe family per DATA-28; optional absoluteValue from mean `*_time(us)` (DATA-33f).
3. **PR-VM-003** — Overview series from `Sampling.json` `ph:C` (DATA-39): one track per counter name present on product fixtures with Sampling; empty when Sampling absent (`out.rep`); never invented from PipeUtilization.
4. **PR-VM-005** — Pipe items are side-specific (`aic_*` vs `aiv_*`); no blended AIC/AIV family ratio.
5. **PR-VM-006** — `computeTables` includes PipeUtilization, ArithmeticUtilization, ResourceConflictRatio with non-empty headers/rows and blockIds `0`…`7` on `out.rep`.
6. **PR-VM-007** — `memoryTables` includes Memory.csv, L2Cache.csv, MemoryL0.csv, MemoryUB.csv with blockIds; `csvTexts` has raw text for each present table fileName.
7. **PR-VM-008** — ICache Miss included when rate mean present.
8. **PR-VM-009** — Roofline GM point + mix labels from the `summary.jsonl` `ArithmeticUtilization` + `Memory` categories (the `All` scope), else ArithmeticUtilization + Memory CSVs (DATA-37a/b/e, DATA-19 / DATA-29); capability `roofline` when points exist; omit when insufficient.
9. **PR-VM-010** — `hardwareDetails` from HardwareInfo.jsonl (preferred) or OpBasicInfo fallback; omit when empty; capability `hardwareDetails` when present. StatsAside shows missing-hardware copy when omitted (UI-30, UI-31).
10. **PR-VM-011** — `memoryTopology` from Memory* CSVs; `out.rep` UB/Vec/GM 2:1 and `from→to`; L2↔L1 from Memory.csv; UB from `Memory.csv` `aiv_ub_to_gm_bw` / `aiv_gm_to_ub_bw` (DATA-22 / DATA-23); hide NA, show 0.
11. **PR-VM-012** — Topology labels come only from the requested `block_id`; first labelled block is used for the adapter snapshot.
11b. **PR-VM-012b** — `l2.peakPct` from first non-NA L2Cache hit-rate column (DATA-20 / DATA-21); matches `l2-hit` edge value.
12. **PR-VM-013** — `bandwidthCards` read `summary.jsonl` `OpInfoSummary`: read / write = the producer's summed sides `aicore_gm_read_bw(GB/s)` / `aicore_gm_write_bw(GB/s)`; peak from `OpInfoSummary.aicore_gm_bw_theoretical(GB/s)` = 1600 shared by both sides. When the summed field is absent, fall back to the aic + aiv `category: Memory` columns (`aic_main_mem_read_bw` + `aiv_main_mem_read_bw`, likewise write), and to `Memory.csv` non-`NA` means per block without `summary.jsonl`; omit NA sides/cards. The card does **not** use `aicore_gm_bw_usage_rate(%)` (a mean of the per-path usage columns, DATA-8). Also covers unmodified `out.rep` (aiv-only; peak 1600).
13. **PR-VM-014** — `summary.coreCount` from `HardwareInfo.jsonl` by op type (cube/vector/mix); omit when jsonl or field missing.
14. **PR-VM-015** — `computeCard` from Product `OpInfoSummary` FLOPS when present; else ArithmeticUtilization + HardwareInfo peaks (DATA-33h); omit when no side has measured + peak.
15. **PR-VM-016** — When both OpBasicInfo.csv and Summary.jsonl exist, identity comes from OpBasicInfo and OpInfoSummary derived FLOPS/util overlay onto summary + computeCard.
16. **PR-VM-017** — Block scope is one selector for every CSV-backed widget (DATA-19 / DATA-28 / DATA-29): `All` = the `summary.jsonl` category mean (`PipeUtilization` for PIPE, `Memory` for the diagram, `ArithmeticUtilization` + `Memory` for the roofline), a picked `block_id` = that block's CSV row; neither re-derives the other's value. A picked id never falls back to the `All` value. Without `summary.jsonl` the `All` scope falls back to the CSV data.
17. **PR-VM-018** — `bandwidthCardsFromRows(rows, peak)` (picked block) sums that block's aic + aiv sides per direction into a single `aicore` side; peak defaults to SOL 1600 and follows `OpInfoSummary.aicore_gm_bw_theoretical(GB/s)` when resolved (DATA-8 / DATA-19).
18. **PR-VM-019** — `computeCardFromRows(rows, summary, peakFallback?)` measures the block's `ArithmeticUtilization.csv` row and takes the chip-level theoretical FLOPS from `OpInfoSummary`, or the All card's peak for a classic `.rep`; no side without both measured and peak, and never an invented peak (DATA-19).
19. **PR-VM-020** — `rooflineFromRows(arithRows, memRows)` computes the GM point from the rows it is given, so the roofline follows the block scope (DATA-19).

## Edge Cases

- Missing OpBasicInfo.csv → summary defaults to empty/0.
- All NA ratios for a family → occupancy item omitted.
- Missing optional CSV embed → that table omitted (no empty stub).
- Chrome Trace with no X events → throws (chromeTraceToSwimlane behavior).
- Missing Memory.csv or all-NA main-mem BW → `bandwidthCards` omitted.
- Missing HardwareInfo and empty OpBasicInfo → no `hardwareDetails` field.

## Dependencies

DATA-8, DATA-19, DATA-25, DATA-28, DATA-29, DATA-33, DATA-33d, DATA-33f, DATA-39, DATA-34a, DATA-37a–f. [rep-format](./rep-format.spec.md), [swimlane-model](./swimlane-model.spec.md).

## Open

DATA-37 — Product-final roofline (axes / roof lines / tabs remain open; compute formula given but no chart-axis spec).

## Changelog
- **2026-09-11** — Roofline `All` now reads the `summary.jsonl` `ArithmeticUtilization` + `Memory` categories instead of re-deriving a CSV mean, so PIPE / roofline / topology share one aggregate (DATA-19 / DATA-29; PR-VM-017). 详情 follows the selector — a picked id replaces the category list with that block's CSV row, and a picked block with no data blanks its widget rather than repeating `All`; `computeCardFromRows` gains the All card's chip-level peak as `peakFallback` (PR-VM-019; PR-STATS-014c / 014d). Roofline `peakBandwidthGBs` for `All` becomes the max of the `Memory` category means (interim DATA-37d, until Product closes DATA-37).
- **2026-09-11** — Block scope is one selector for every CSV-backed widget (`All` = `summary.jsonl` non-`NA` mean, a picked id = that block's CSV row), implemented in the adapter (PIPE, memory topology) and StatsAside (BW / compute / roofline) (DATA-19 / DATA-28 / DATA-29; PR-VM-017–020). BW cards sum the aic + aiv sides (`aicore_gm_read_bw` / `aicore_gm_write_bw`) instead of meaning them (DATA-8). Memory topology adds L0C → L1 / L0C → L2/GM (DATA-24 / DATA-25). `data/build_sample_rep.py` no longer renames `MemoryUB.csv` `*_scalar` → `*_gm`, so no fixture carries the columns the producer does not emit (DATA-22 / DATA-23).
- **2026-09-10** — Memory topology UB→L2 / L2→UB read `Memory.csv` `aiv_ub_to_gm_bw` / `aiv_gm_to_ub_bw` (DATA-22 / DATA-23); the producer does not emit the `MemoryUB.csv` `*_gm` names (PR-VM-011). Master paired those `*_gm` columns with the **opposite** direction (`ub-l2` → `aiv_ub_read_bw_gm`, `l2-ub` → `aiv_ub_write_bw_gm`); because both read `0.0` the sample's two edges rendered `0.00 GB/s`. Dropping the source is what fixed that (now `8.38` / `16.76 GB/s`).
- **2026-09-07** — L2 `peakPct` on topology nodes (DATA-20 / DATA-21, PR-VM-012b).
- **2026-09-04** — NPU-Compute: `summary.jsonl` is the canonical source — `OpInfoSummary` derived fields (compute/BW/parallel utilization), summary-first detail categories, `PipeTrace.json` µs timeline, spaced HardwareInfo key normalization, peak 1600 GB/s (SOL), compute score = measured/theoretical (DATA-2, DATA-3, DATA-5, DATA-9, DATA-33, UI-32).
- **2026-09-01** — `summary.coreCount` from `HardwareInfo.jsonl` by op type for duration secondary (DATA-1, UI-32, PR-VM-014).
- **2026-08-25** — Aside meta is 进程 / 算子类型 / Blocks (`pid` / `opType` / `blockDim`); `coreCount` is not a meta-row field.
- **2026-08-21** — UB/Vec arrows: `ub_read_*` = leaving UB (`out.rep` add 2:1, PR-VM-011).
- **2026-08-20** — npu-compute 0818: duration / measured BW / ICache / HardwareInfo.jsonl / L2↔L1 / NA-hide confirmed; UB product names first (PR-VM-010/011).
- **2026-08-19** — DATA-33g peak is sketch 1600 GB/s (not max of measured); `bandwidthCards` optional (PR-VM-013).
- **2026-08-19** — DATA-33g `bandwidthCards` (PR-VM-013).
- **2026-08-13** — PR-VM-011/012 memory topology helper; first labelled block snapshot.
- **2026-08-10** — hardwareDetails DATA-34a (PR-VM-010).
- **2026-08-10** — RooflineViewModel interim DATA-37a–f (PR-VM-009).
- **2026-08-07** — Optional `absoluteValue` (DATA-33f) and ICache Miss (PR-VM-008) on pipe occupancy.
- **2026-08-07** — Optional `coreCount` / `npuArchLabel` on SummaryMetrics for aside meta shell; adapter may leave unset.
- **2026-08-07** — M1 CsvTableModel compute/memory tables + csvTexts (PR-VM-006/007).
- **2026-08-07** — Pipe `side` for existing PIPE Cube|Vector toggle.
- **2026-08-05** — Initial spec. Core behaviors established.
