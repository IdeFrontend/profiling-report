# Swimlane Model

<!--
  spec-id-prefix: PR-SWIM-*
  phase: MVP
  source: src/domain/types.ts, src/adapters/chromeTraceToSwimlane.ts
  test: tests/unit/swimlaneModel.spec.ts
-->

Canonical types driving the swimlane renderer. `SwimlaneModel` = ordered processes, each with threads, each with events.

```ts
interface SwimlaneModel { processes: SwimProcess[]; minTime: number; maxTime: number; }
interface SwimProcess  { id: string; name: string; threads: SwimThread[]; }
interface SwimThread   { id: string; name: string; events: SwimEvent[]; utilization?: number; }
interface SwimEvent    { id: string; name: string; startTime: number; duration: number; args?: {} }
```

**Behavior:** `chromeTraceToSwimlane` converts CTE→SwimlaneModel. Processes/threads ordered by first event time. Events mandatory: `id`, `name`, `startTime`, `duration`.

## Acceptance Criteria

1. **PR-SWIM-001**: chromeTraceToSwimlane produces correct process/thread/event structure from a Chrome Trace.
1. **PR-SWIM-002**: SwimThread.events sorted by startTime ascending.
1. **PR-SWIM-003**: Empty trace with no complete X events throws.
1. **PR-SWIM-004**: Overlapping events preserved in original order within each thread.
1. **PR-SWIM-005**: Processes/threads with no events excluded from the model.

## Edge Cases

- Empty trace — throws `no complete X events`.
- Single event — process/thread created with one event.

**Dependencies:** [view-models](./view-models.spec.md).

**Open:** Q8 — Lane hierarchy; use producer thread_name as-is.
