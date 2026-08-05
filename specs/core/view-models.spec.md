# View Models

<!--
  spec-id-prefix: PR-VM-*
  phase: MVP
  source: src/adapters/adaptRep.ts
  test: tests/unit/viewModels.spec.ts
-->

Adapt parsed `.rep` data into canonical `ReportViewModel` and `SwimlaneModel`.

```ts
adaptRep(parsed: ParsedRep): AdaptedReport  // { swimlaneModel, reportModel, capabilities }
```

| Parameter | Type | Description |
|-----------|------|-------------|
| parsed | ParsedRep | Output of `parseRep()` |

**Behavior:** Extracts OpBasicInfo→ReportViewModel with name, type, duration, block dim. Pipe occupancy: mean of non-NA ratios per pipe family (I-Q6b). Converts Chrome Trace→SwimlaneModel. Overview series: empty array (I-Q5+). Summary: thin — name, type, duration only (I-Q6a).

## Acceptance Criteria

1. **PR-VM-001**: ReportViewModel.summary contains name, type, duration; compute/BW/util absent per I-Q6a.
1. **PR-VM-002**: PipeOccupancy aggregates mean of non-NA ratios per pipe family per I-Q6b.
1. **PR-VM-003**: Overview series returns empty array per I-Q5+.

## Edge Cases

- Missing OpBasicInfo.csv — summary defaults to empty/0.
- All NA pipe ratios — occupancy items have zero values.
- Chrome Trace with no events — throws (handled upstream by chromeTraceToSwimlane).

**Dependencies:** I-Q6a, I-Q6b, I-Q5+.

**Open:** Q6 — Product-final summary formulas; current I-Q6a/b are interim.
