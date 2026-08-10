# View Models

| spec-id-prefix |
|----------------|
| PR-VM-*        |

Adapt parsed `.rep` container data into canonical `ReportViewModel` and `SwimlaneModel` consumable by the UI layer.

```ts
adaptRep(parsed: ParsedRep): AdaptedReport  // { swimlaneModel, reportModel, capabilities }
```

## Behavior

**Report summary.** Extracts `OpBasicInfo.csv` into `ReportViewModel.summary`: op name, op type, task duration (microseconds as stored in CSV), optional `blockDim` from `Block Dim` (pass-through string/number, no formula). In MVP (I-Q6a), compute TFLOPS, bandwidth, and core utilization exist in the type but are left undefined.

**Aside meta (shell).** Optional header fields on `SummaryMetrics`: `coreCount?: number`, `npuArchLabel?: string`, plus existing `currentFreq` (displayed as aic频率). Adapter may leave `coreCount` / `npuArchLabel` unset until `HardwareInfo` / Product mapping exists — UI hides missing segments.

**Pipe occupancy.** Reads `PipeUtilization.csv`, computes per-pipe-family means of non-NA ratios across all rows (I-Q6b). Optional `absoluteValue` = mean non-NA matching `*_time(us)` (I-Q6f). Include ICache Miss items when `*_icache_miss_rate` mean is present. Each item is **side-specific**: Cube uses `aic_*` columns, Vector uses `aiv_*` (VIEW_DATA_MAPPING tables). Shared family names (MTE2, Scalar) appear as separate cube/vector items — never a blended AIC+AIV mean. Ratios merge into matching swimlane threads by `laneColorKey` (mean when both sides contribute the same key).

**CSV detail tables (M1).** Builds `CsvTableModel` entries for compute tabs (`PipeUtilization`, `ArithmeticUtilization`, `ResourceConflictRatio`) and memory tabs (`Memory.csv`, `L2Cache`, `MemoryL0`, `MemoryUB`). Each table includes headers, rows, and distinct `blockIds` in fixture order (I-Q6c). Missing embeds are omitted. Raw CSV text is stored in `csvTexts[fileName]` for 查看全部 (I-Q6d).

**Swimlane model.** Extracts `trace.json` via `chromeTraceToSwimlane` with `sourceTimeUnit: 'ns'`.

**Overview series.** Empty array per I-Q5+.

**Chrome Trace–only loads.** `emptyReportViewModel()` / `adaptChromeTrace` leave compute/memory tables and `csvTexts` empty (Q15).

## Acceptance Criteria

1. **PR-VM-001** — ReportViewModel.summary contains name, type, duration; optional blockDim pass-through; compute/BW/util unset per I-Q6a.
2. **PR-VM-002** — PipeOccupancy aggregates mean of non-NA ratios per pipe family per I-Q6b; optional absoluteValue from mean `*_time(us)` (I-Q6f).
3. **PR-VM-003** — Overview series returns empty array per I-Q5+.
4. **PR-VM-005** — Pipe items are side-specific (`aic_*` vs `aiv_*`); no blended AIC/AIV family ratio.
5. **PR-VM-006** — `computeTables` includes PipeUtilization, ArithmeticUtilization, ResourceConflictRatio with non-empty headers/rows and blockIds `0`…`7` on `out.rep`.
6. **PR-VM-007** — `memoryTables` includes Memory.csv, L2Cache.csv, MemoryL0.csv, MemoryUB.csv with blockIds; `csvTexts` has raw text for each present table fileName.
7. **PR-VM-008** — ICache Miss included when rate mean present.

## Edge Cases

- Missing OpBasicInfo.csv → summary defaults to empty/0.
- All NA ratios for a family → occupancy item omitted.
- Missing optional CSV embed → that table omitted (no empty stub).
- Chrome Trace with no X events → throws (chromeTraceToSwimlane behavior).

## Dependencies

I-Q6a, I-Q6b, I-Q6c, I-Q6d, I-Q6f, I-Q5+. [rep-format](./rep-format.spec.md), [swimlane-model](./swimlane-model.spec.md).

## Open

Q6 — Product-final summary formulas. Q22 — measureRange aside sync. M2 topology edge labels.

## Changelog
- **2026-08-07** — Optional `absoluteValue` (I-Q6f) and ICache Miss (PR-VM-008) on pipe occupancy.
- **2026-08-07** — Optional `coreCount` / `npuArchLabel` on SummaryMetrics for aside meta shell; adapter may leave unset.
- **2026-08-07** — M1 CsvTableModel compute/memory tables + csvTexts (PR-VM-006/007).
- **2026-08-07** — Pipe `side` for existing PIPE Cube|Vector toggle.
- **2026-08-05** — Initial spec. Core behaviors established.
