# View Models

| spec-id-prefix |
|----------------|
| PR-VM-*        |

Adapt parsed `.rep` container data into canonical `ReportViewModel` and `SwimlaneModel` consumable by the UI layer.

```ts
adaptRep(parsed: ParsedRep): AdaptedReport  // { swimlaneModel, reportModel, capabilities }
```

## Behavior

**Report summary.** Extracts `OpBasicInfo.csv` into `ReportViewModel.summary`: op name, op type, task duration (**confirmed** `Task Duration(us)`), optional `blockDim` from `Block Dim` (pass-through). Compute TFLOPS and core utilization stay unset. I/O bandwidth cards are `bandwidthCards` (I-Q6g): **measured columns confirmed**; peak/score still interim.

**I/O bandwidth (I-Q6g).** From `Memory.csv`: mean of non-`NA` `aic_main_mem_{read|write}_bw(GB/s)` / `aiv_main_mem_{read|write}_bw(GB/s)` (first matching header only; also accepts headers without the `(GB/s)` suffix). Peak = **1600 GB/s** (sketch 1.6 TB/s) for every side. Omit a side when all-NA; omit the card when both sides NA; omit `bandwidthCards` when Memory.csv is missing.

**Aside meta (shell).** Optional header fields on `SummaryMetrics`: `coreCount?: number`, `npuArchLabel?: string`, plus `currentFreq` (**aic频率 confirmed:** `OpBasicInfo.csv` `Current Freq`). Adapter leaves `coreCount` / `npuArchLabel` unset. UI hides missing segments. **Rated Freq** is stored but not shown on the shell.

**Pipe occupancy.** Reads `PipeUtilization.csv`, computes per-pipe-family means of non-NA ratios across all rows (I-Q6b). Optional `absoluteValue` = mean non-NA matching `*_time(us)` (I-Q6f). **ICache Miss confirmed:** include when `*_icache_miss_rate` mean is present. Each item is **side-specific**: Cube uses `aic_*` columns, Vector uses `aiv_*`. Shared family names (MTE2, Scalar) appear as separate cube/vector items — never a blended AIC+AIV mean. Ratios merge into matching swimlane threads by `laneColorKey` (mean when both sides contribute the same key).

**CSV detail tables (M1).** Builds `CsvTableModel` entries for compute tabs (`PipeUtilization`, `ArithmeticUtilization`, `ResourceConflictRatio`) and memory tabs (`Memory.csv`, `L2Cache`, `MemoryL0`, `MemoryUB`). Each table includes headers, rows, and distinct `blockIds` in fixture order (I-Q6c). Missing embeds are omitted. Raw CSV text is stored in `csvTexts[fileName]` for 查看全部 (I-Q6d).

**Swimlane model.** Extracts `trace.json` via `chromeTraceToSwimlane` with `sourceTimeUnit: 'ns'`.

**Overview series.** Empty array per I-Q5+.

**Chrome Trace–only loads.** `emptyReportViewModel()` / `adaptChromeTrace` leave compute/memory tables and `csvTexts` empty (Q15).

**Roofline (M2 interim I-Q11*).** When `ArithmeticUtilization.csv` and `Memory.csv` yield a GM point: set `reportModel.roofline` and include `'roofline'` in `capabilities`. Omit `roofline` (and the capability) when undecidable. L2 omitted (I-Q11c). Tabs omitted (I-Q11f).

**Hardware details (M1).** Prefer `HardwareInfo.jsonl` category sections (product source); else OpBasicInfo non-empty columns. Omit when neither yields fields. Include `'hardwareDetails'` in capabilities when model present. Do **not** map jsonl `ai_core_count` / `chip_info` onto aside meta 核数 / NPU ARCH until Product says so.

**Memory topology (M2, change-log #5).** Build `reportModel.memoryTopology` from Memory* CSVs per [VIEW_DATA_MAPPING §11.2.6](../ui/VIEW_DATA_MAPPING.md). L2↔L1 from `Memory.csv`. UB→L2 / L2→UB: product `MemoryUB.csv` names first, then sample `Memory.csv` names. `buildMemoryTopology(tables, blockId)` rebuilds labels for another block (I-Q6c). Hide `NA` labels; **show 0**. Omit `memoryTopology` (and `'memoryDiagram'`) when no edge yields a label.

## Acceptance Criteria

1. **PR-VM-001** — ReportViewModel.summary contains name, type, duration; optional blockDim pass-through; compute/util unset per I-Q6a.
2. **PR-VM-002** — PipeOccupancy aggregates mean of non-NA ratios per pipe family per I-Q6b; optional absoluteValue from mean `*_time(us)` (I-Q6f).
3. **PR-VM-003** — Overview series returns empty array per I-Q5+.
4. **PR-VM-005** — Pipe items are side-specific (`aic_*` vs `aiv_*`); no blended AIC/AIV family ratio.
5. **PR-VM-006** — `computeTables` includes PipeUtilization, ArithmeticUtilization, ResourceConflictRatio with non-empty headers/rows and blockIds `0`…`7` on `out.rep`.
6. **PR-VM-007** — `memoryTables` includes Memory.csv, L2Cache.csv, MemoryL0.csv, MemoryUB.csv with blockIds; `csvTexts` has raw text for each present table fileName.
7. **PR-VM-008** — ICache Miss included when rate mean present.
8. **PR-VM-009** — Roofline GM point + mix labels from ArithmeticUtilization + Memory (I-Q11a/b/e); capability `roofline` when points exist; omit when CSVs insufficient.
9. **PR-VM-010** — `hardwareDetails` from HardwareInfo.jsonl (preferred) or OpBasicInfo fallback; omit when empty; capability `hardwareDetails` when present.
10. **PR-VM-011** — `memoryTopology` from Memory* CSVs; `out.rep` UB/Vec 2:1; L2↔L1 from Memory.csv; UB product names first; hide NA, show 0.
11. **PR-VM-012** — Topology labels come only from the requested `block_id`; first labelled block is used for the adapter snapshot.
12. **PR-VM-013** — `bandwidthCards` from Memory.csv mean non-NA main-mem BW; peak 1600 GB/s; omit NA sides/cards (I-Q6g). Also covers unmodified `out.rep` (aiv-only; peak 1600).

## Edge Cases

- Missing OpBasicInfo.csv → summary defaults to empty/0.
- All NA ratios for a family → occupancy item omitted.
- Missing optional CSV embed → that table omitted (no empty stub).
- Chrome Trace with no X events → throws (chromeTraceToSwimlane behavior).
- Missing Memory.csv or all-NA main-mem BW → `bandwidthCards` omitted.
- Missing HardwareInfo and empty OpBasicInfo → no `hardwareDetails` field.

## Dependencies

I-Q6a, I-Q6b, I-Q6c, I-Q6d, I-Q6f, I-Q6g, I-Q5+, I-Q7a, I-Q11a–f. [rep-format](./rep-format.spec.md), [swimlane-model](./swimlane-model.spec.md).

## Open

Q6 — Product-final summary formulas (compute / avg util still open; bandwidth I-Q6g). Q11 — Product-final roofline. Q22 — measureRange aside sync.

## Changelog
- **2026-08-21** — UB/Vec arrows: `ub_read_*` = leaving UB (`out.rep` add 2:1, PR-VM-011).
- **2026-08-20** — npu-compute 0818: duration / measured BW / ICache / HardwareInfo.jsonl / L2↔L1 / NA-hide confirmed; UB product names first (PR-VM-010/011).
- **2026-08-19** — I-Q6g peak is sketch 1600 GB/s (not max of measured); `bandwidthCards` optional (PR-VM-013).
- **2026-08-19** — I-Q6g `bandwidthCards` (PR-VM-013).
- **2026-08-13** — PR-VM-011/012 memory topology helper; first labelled block snapshot.
- **2026-08-10** — hardwareDetails I-Q7a (PR-VM-010).
- **2026-08-10** — RooflineViewModel interim I-Q11a–f (PR-VM-009).
- **2026-08-07** — Optional `absoluteValue` (I-Q6f) and ICache Miss (PR-VM-008) on pipe occupancy.
- **2026-08-07** — Optional `coreCount` / `npuArchLabel` on SummaryMetrics for aside meta shell; adapter may leave unset.
- **2026-08-07** — M1 CsvTableModel compute/memory tables + csvTexts (PR-VM-006/007).
- **2026-08-07** — Pipe `side` for existing PIPE Cube|Vector toggle.
- **2026-08-05** — Initial spec. Core behaviors established.
