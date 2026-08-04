# Swimlane Model

<!--
  metadata
  spec-id-prefix: PR-SWIM-*
  phase: MVP
  owner: -
  last-updated: 2026-08-04
  source: src/core/types.ts (SwimlaneModel et al.)
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

## Edge Cases

- Empty trace array — returns model with empty processes and zero time range.
- Single event — process/thread created with one event.
- Overlapping events in same thread — preserved as-is; deduplication is renderer concern.

## Dependencies

- [specs/core/view-models.spec.md] — adapter that produces SwimlaneModel.
- [docs/specs/architecture/COMPONENTS.md] — canonical model definitions.

## Open Questions

- [Q8] — Lane hierarchy; use producer thread_name as-is.
