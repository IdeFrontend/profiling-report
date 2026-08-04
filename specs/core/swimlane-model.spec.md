# Swimlane Model

<!--
  metadata
  spec-id-prefix: PR-SWIM-*
  phase: MVP
  owner: -
  last-updated: 2026-08-04
  source: src/domain/types.ts (SwimlaneModel et al.)
  test: tests/unit/swimlaneModel.spec.ts
-->

## Purpose

Define the canonical SwimlaneModel and its constituent types (SwimProcess, SwimThread, SwimEvent) that drive the swimlane renderer.

## Inputs / Outputs

```ts
interface SwimlaneModel {
  processes: SwimProcess[];
  minTime: number;
  maxTime: number;
}
```

| Field | Type | Description |
|-------|------|-------------|
| processes | SwimProcess[] | Ordered list of processes |
| minTime | number | Earliest event start (µs) |
| maxTime | number | Latest event end (µs) |

SwimProcess contains SwimThread[], each containing SwimEvent[].

## Behavior

- chromeTraceToSwimlane converts CTE format into SwimlaneModel.
- Processes and threads are ordered by their first event time.
- Events have mandatory fields: name, start, end.
- Optional fields: colorKey, category, args for tooltip enrichment.

## Acceptance Criteria

1. **PR-SWIM-001**: chromeTraceToSwimlane produces correct process/thread/event structure from a Chrome Trace.
1. **PR-SWIM-002**: SwimThread.events are sorted by startTime in ascending order.
1. **PR-SWIM-003**: Empty trace with no complete X events throws an error.
1. **PR-SWIM-004**: Trace with overlapping events preserves all events in original order within each thread.
1. **PR-SWIM-005**: Processes and threads with no events are excluded from the model.

## Edge Cases

- Empty trace array — throws `no complete X events` error.
- Single event — process/thread created with one event.
- Overlapping events in same thread — preserved as-is; deduplication is renderer concern.

## Dependencies

- [specs/core/view-models.spec.md] — adapter that produces SwimlaneModel.
- [docs/specs/architecture/COMPONENTS.md] — canonical model definitions.

## Open Questions

- [Q8] — Lane hierarchy; use producer thread_name as-is.
