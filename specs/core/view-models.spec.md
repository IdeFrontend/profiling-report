# View Models

| spec-id-prefix |
|----------------|
| PR-VM-*        |

Adapt parsed `.rep` container data into canonical `ReportViewModel` and `SwimlaneModel` consumable by the UI layer.

```ts
adaptRep(parsed: ParsedRep): AdaptedReport  // { swimlaneModel, reportModel, capabilities }
```

## Behavior

**Report summary.** Extracts `OpBasicInfo.csv` into `ReportViewModel.summary`: op name, op type, task duration (**confirmed** `Task Duration(us)`), `pid` from `Pid` / `PID`, `blockDim` from `Block Dim`, `coreCount` from `HardwareInfo.jsonl` by op type (DATA-1). Compute TFLOPS and core utilization stay unset. I/O bandwidth cards are `bandwidthCards` (DATA-33g): **measured columns confirmed**; peak/score still interim.

**I/O bandwidth (DATA-33g).** From `Memory.csv`: mean of non-`NA` `aic_main_mem_{read|write}_bw(GB/s)` / `aiv_main_mem_{read|write}_bw(GB/s)` (first matching header only; also accepts headers without the `(GB/s)` suffix). Peak = **1600 GB/s** for every side. UI displays **GB/s** (UI-34). Omit a side when all-NA; omit the card when both sides NA; omit `bandwidthCards` when Memory.csv is missing.

**Aside meta (shell).** v930 header is **进程** / **算子类型** / **Blocks** from `pid`, `opType`, `blockDim`. Hide a segment when unset; hide the row when all three are empty. Do **not** put 核数, aic频率, or NPU ARCH on this row. `currentFreq` / `ratedFreq` stay on the model for the hardware overlay fallback; they are not shell fields. Overlay `chip_info` / `arch_info` stay in `hardwareDetails`.

**Pipe occupancy.** Reads `PipeUtilization.csv`, computes per-pipe-family means of non-NA ratios across all rows (DATA-33b). Optional `absoluteValue` = mean non-NA matching `*_time(us)` (DATA-33f). **ICache Miss confirmed:** include when `*_icache_miss_rate` mean is present. Each item is **side-specific**: Cube uses `aic_*` columns, Vector uses `aiv_*`. Shared family names (MTE2, Scalar) appear as separate cube/vector items — never a blended AIC+AIV mean. Ratios merge into matching swimlane threads by `laneColorKey` (mean when both sides contribute the same key).

**CSV detail tables (M1).** Builds `CsvTableModel` entries for compute tabs (`PipeUtilization`, `ArithmeticUtilization`, `ResourceConflictRatio`) and memory tabs (`Memory.csv`, `L2Cache`, `MemoryL0`, `MemoryUB`). Each table includes headers, rows, and distinct `blockIds` in fixture order (DATA-33c). Missing embeds are omitted. Raw CSV text is stored in `csvTexts[fileName]` for 查看全部 (DATA-33d).

**Swimlane model.** Extracts `trace.json` via `chromeTraceToSwimlane` with `sourceTimeUnit: 'ns'`.

**Overview series.** Empty array per DATA-32a.

**Chrome Trace–only loads.** `emptyReportViewModel()` / `adaptChromeTrace` leave compute/memory tables and `csvTexts` empty (PROC-3).

**Roofline (M2 interim DATA-37*).** When `ArithmeticUtilization.csv` and `Memory.csv` yield a GM point: set `reportModel.roofline` and include `'roofline'` in `capabilities`. Omit `roofline` (and the capability) when undecidable. L2 omitted (DATA-37c). Tabs omitted (DATA-37f).

**Hardware details (M1).** Prefer `HardwareInfo.jsonl` category sections (product source); else OpBasicInfo non-empty columns. Omit when neither yields fields. Include `'hardwareDetails'` in capabilities when model present. **StatsAside** always shows **更多** on the report shell; when the adapter omits `hardwareDetails`, the overlay shows **缺少 hardware info** (UI-30, UI-31). Do **not** map jsonl `ai_core_count` / `chip_info` onto the aside meta row.

**Memory topology (M2, change-log #5).** Build `reportModel.memoryTopology` from Memory* CSVs per [VIEW_DATA_MAPPING §11.2.6](../ui/VIEW_DATA_MAPPING.md). L2↔L1 from `Memory.csv`. UB→L2 / L2→UB: product `MemoryUB.csv` names first, then sample `Memory.csv` names. `buildMemoryTopology(tables, blockId)` rebuilds labels for another block (DATA-33c). Hide `NA` labels; **show 0**. Omit `memoryTopology` (and `'memoryDiagram'`) when no edge yields a label.

## Acceptance Criteria

1. **PR-VM-001** — ReportViewModel.summary contains name, type, duration, pid, blockDim, optional coreCount (DATA-1); compute/util unset per DATA-33a.
2. **PR-VM-002** — PipeOccupancy aggregates mean of non-NA ratios per pipe family per DATA-33b; optional absoluteValue from mean `*_time(us)` (DATA-33f).
3. **PR-VM-003** — Overview series returns empty array per DATA-32a.
4. **PR-VM-005** — Pipe items are side-specific (`aic_*` vs `aiv_*`); no blended AIC/AIV family ratio.
5. **PR-VM-006** — `computeTables` includes PipeUtilization, ArithmeticUtilization, ResourceConflictRatio with non-empty headers/rows and blockIds `0`…`7` on `out.rep`.
6. **PR-VM-007** — `memoryTables` includes Memory.csv, L2Cache.csv, MemoryL0.csv, MemoryUB.csv with blockIds; `csvTexts` has raw text for each present table fileName.
7. **PR-VM-008** — ICache Miss included when rate mean present.
8. **PR-VM-009** — Roofline GM point + mix labels from ArithmeticUtilization + Memory (DATA-37a/b/e); capability `roofline` when points exist; omit when CSVs insufficient.
9. **PR-VM-010** — `hardwareDetails` from HardwareInfo.jsonl (preferred) or OpBasicInfo fallback; omit when empty; capability `hardwareDetails` when present. StatsAside shows missing-hardware copy when omitted (UI-30, UI-31).
10. **PR-VM-011** — `memoryTopology` from Memory* CSVs; `out.rep` UB/Vec/GM 2:1 and `from→to`; L2↔L1 from Memory.csv; UB product names first; hide NA, show 0.
11. **PR-VM-012** — Topology labels come only from the requested `block_id`; first labelled block is used for the adapter snapshot.
12. **PR-VM-013** — `bandwidthCards` from Memory.csv mean non-NA main-mem BW; peak 1600 GB/s; omit NA sides/cards (DATA-33g). Also covers unmodified `out.rep` (aiv-only; peak 1600).
13. **PR-VM-014** — `summary.coreCount` from `HardwareInfo.jsonl` by op type (cube/vector/mix); omit when jsonl or field missing.

## Edge Cases

- Missing OpBasicInfo.csv → summary defaults to empty/0.
- All NA ratios for a family → occupancy item omitted.
- Missing optional CSV embed → that table omitted (no empty stub).
- Chrome Trace with no X events → throws (chromeTraceToSwimlane behavior).
- Missing Memory.csv or all-NA main-mem BW → `bandwidthCards` omitted.
- Missing HardwareInfo and empty OpBasicInfo → no `hardwareDetails` field.

## Dependencies

DATA-33a, DATA-33b, DATA-33c, DATA-33d, DATA-33f, DATA-33g, DATA-32a, DATA-34a, DATA-37a–f. [rep-format](./rep-format.spec.md), [swimlane-model](./swimlane-model.spec.md).

## Open

DATA-33 — Product-final summary formulas (compute / avg util still open; bandwidth DATA-33g). DATA-37 — Product-final roofline.

## Changelog
- **2026-09-01** — `summary.coreCount` from `HardwareInfo.jsonl` by op type for duration bar/secondary (DATA-1, UI-32, PR-VM-014).
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
