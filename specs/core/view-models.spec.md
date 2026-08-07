# View Models

| spec-id-prefix |
|----------------|
| PR-VM-*        |

Adapt parsed `.rep` container data into canonical `ReportViewModel` and `SwimlaneModel` consumable by the UI layer.

```ts
adaptRep(parsed: ParsedRep): AdaptedReport  // { swimlaneModel, reportModel, capabilities }
```

## Behavior

**Report summary.** Extracts `OpBasicInfo.csv` into `ReportViewModel.summary`: op name, op type, task duration (microseconds as stored in CSV). In MVP (I-Q6a), only these thin fields are populated — compute TFLOPS, bandwidth, and core utilization exist in the type but are left undefined.

**Pipe occupancy.** Reads `PipeUtilization.csv`, computes per-pipe-family means of non-NA ratios across all rows (I-Q6b). Each item is **side-specific**: Cube uses `aic_*` columns, Vector uses `aiv_*` (VIEW_DATA_MAPPING tables). Shared family names (MTE2, Scalar) appear as separate cube/vector items — never a blended AIC+AIV mean. Ratios merge into matching swimlane threads by `laneColorKey` (mean when both sides contribute the same key).

**Swimlane model.** Extracts `trace.json` via `chromeTraceToSwimlane` with `sourceTimeUnit: 'ns'`.

**Overview series.** Empty array per I-Q5+.

**Planned (not in this branch’s code):** CSV detail tables, memory edge labels — design specs only until new views are implemented.

## Acceptance Criteria

1. **PR-VM-001** — ReportViewModel.summary contains name, type, duration; compute/BW/util unset per I-Q6a.
2. **PR-VM-002** — PipeOccupancy aggregates mean of non-NA ratios per pipe family per I-Q6b.
3. **PR-VM-003** — Overview series returns empty array per I-Q5+.
4. **PR-VM-005** — Pipe items are side-specific (`aic_*` vs `aiv_*`); no blended AIC/AIV family ratio.

## Edge Cases

- Missing OpBasicInfo.csv → summary defaults to empty/0.
- All NA ratios for a family → occupancy item omitted.
- Chrome Trace with no X events → throws (chromeTraceToSwimlane behavior).

## Dependencies

I-Q6a, I-Q6b, I-Q5+. [rep-format](./rep-format.spec.md), [swimlane-model](./swimlane-model.spec.md).

## Open

Q6 — Product-final summary formulas. Q22 — measureRange aside sync. M1 CSV tabs / M2 topology — specs ahead of code.

## Changelog
- **2026-08-07** — Pipe `side` for existing PIPE Cube|Vector toggle; defer new-view model fields.
- **2026-08-05** — Initial spec. Core behaviors established.
