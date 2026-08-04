# View Models

<!--
  metadata
  spec-id-prefix: PR-VM-*
  phase: MVP
  owner: -
  last-updated: 2026-08-04
  source: src/adapters/adaptRep.ts
  test: tests/unit/viewModels.spec.ts
-->

## Purpose

Adapt parsed report data into canonical view models (ReportViewModel, SwimlaneModel) consumable by UI components.

## Inputs / Outputs

```ts
adaptRep(parsed: ParsedRep): AdaptedReport
```

Where `AdaptedReport` is `{ swimlaneModel, reportModel, capabilities }`.

| Parameter | Type | Description |
|-----------|------|-------------|
| parsed | ParsedRep | Output of `parseRep()` |

## Behavior

- Extracts OpBasicInfo into a ReportViewModel with name, type, duration, and block dim.
- Computes pipe occupancy (mean of non-NA ratios per pipe family) per I-Q6b.
- Converts Chrome Trace events into SwimlaneModel (processes, threads, events).
- Overview series returns empty array per I-Q5+.
- ReportViewModel.summary provides thin OpBasicInfo only (name, type, duration) per I-Q6a.

## Acceptance Criteria

1. **PR-VM-001**: ReportViewModel.summary contains name, type, and duration from OpBasicInfo; compute/BW/util are absent per I-Q6a.
1. **PR-VM-002**: PipeOccupancy aggregates mean of non-NA ratios per pipe family per I-Q6b.
1. **PR-VM-003**: Overview series returns empty array per I-Q5+.

## Edge Cases

- Missing OpBasicInfo.csv — summary fields default to empty/0.
- All NA pipe ratios — occupancy items have zero values.
- Chrome Trace with no events — throws (handled upstream by chromeTraceToSwimlane).

## Dependencies

- [docs/context/INTERIM_DECISIONS.md I-Q6a] — thin OpBasicInfo summary.
- [docs/context/INTERIM_DECISIONS.md I-Q6b] — mean pipe aggregation.
- [docs/context/INTERIM_DECISIONS.md I-Q5+] — overview series empty.

## Open Questions

- [Q6] — Product-final summary formulas; current I-Q6a/b are interim.
