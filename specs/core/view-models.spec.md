# View Models

<!--
  spec-id-prefix: PR-VM-*
  phase: MVP
  source: src/adapters/adaptRep.ts
  test: tests/unit/viewModels.spec.ts
-->

Adapt parsed `.rep` container data into canonical `ReportViewModel` and `SwimlaneModel` consumable by the UI layer.

```ts
adaptRep(parsed: ParsedRep): AdaptedReport  // { swimlaneModel, reportModel, capabilities }
```

## Behavior

**Report summary.** Extracts `OpBasicInfo.csv` into `ReportViewModel.summary`: op name, op type, task duration (microseconds as stored in CSV). In MVP (I-Q6a), only these thin fields are populated — compute TFLOPS, bandwidth, and core utilization exist in the type but are left undefined.

**Pipe occupancy.** Reads `PipeUtilization.csv`, computes per-pipe-family means of non-NA ratios across all rows (I-Q6b). The seven pipe families and their CSV columns: Cube (`aic_cube_*`), Vector (`aiv_vec_*`), MTE2 (`aiv_mte2_*`/`aic_mte2_*`), MTE1 (`aiv_mte1_*`/`aic_mte1_*`), FixP (`aic_fixpipe_*`), MTE3 (`aiv_mte3_*`/`aic_mte3_*`), Scalar (`aiv_scalar_*`). Ratios are merged into matching swimlane threads by `laneColorKey` — threads without a matching pipe get no utilization.

**Swimlane model.** Extracts `trace.json` and converts via `chromeTraceToSwimlane` with `sourceTimeUnit: 'ns'` (the embedded trace uses nanosecond timestamps). Processes/threads ordered by first event time, events sorted by startTime ascending within each thread.

**Overview series.** Returns empty array per I-Q5+ — the producer does not supply overview data, so the overview chart region is hidden in the UI.

## Acceptance Criteria

1. **PR-VM-001**: ReportViewModel.summary contains name, type, duration; compute/BW/util unset per I-Q6a.
1. **PR-VM-002**: PipeOccupancy aggregates mean of non-NA ratios per pipe family per I-Q6b.
1. **PR-VM-003**: Overview series returns empty array per I-Q5+.

## Edge Cases

- Missing OpBasicInfo.csv → summary defaults to empty/0.
- All NA ratios for a family → occupancy item has ratio 0.
- Chrome Trace with no X events → throws (chromeTraceToSwimlane behavior).

## Dependencies

I-Q6a, I-Q6b, I-Q5+. [rep-format](./rep-format.spec.md), [swimlane-model](./swimlane-model.spec.md).

## Open

Q6 — Product-final summary formulas (currently thin per I-Q6a/b).

## Changelog
- **2026-08-05** — Initial spec. Core behaviors established.
