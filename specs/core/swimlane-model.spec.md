# Swimlane Model

<!--
  spec-id-prefix: PR-SWIM-*
  phase: MVP
  source: src/domain/types.ts, src/adapters/chromeTraceToSwimlane.ts
  test: tests/unit/swimlaneModel.spec.ts
-->

Canonical types and conversion logic for the swimlane timeline data driving the renderer.

```ts
interface SwimlaneModel { processes: SwimProcess[]; minTime: number; maxTime: number; }
interface SwimProcess  { id: string; name: string; threads: SwimThread[]; }
interface SwimThread   { id: string; name: string; events: SwimEvent[]; utilization?: number; }
interface SwimEvent    { id: string; name: string; startTime: number; duration: number; args?: {} }
```

## Behavior

**Chrome Trace conversion.** `chromeTraceToSwimlane` receives a Chrome Trace Event Format JSON array and an optional `sourceTimeUnit` (defaults to `'us'`, but `.rep`-embedded traces use `'ns'`). It groups complete X events (`ph: 'X'`, with both `ts` and `dur`) by process ID (`pid`) and thread ID (`tid`). Each event becomes a `SwimEvent` with `id`, `name`, `startTime`, `duration`. Optional `cat` and `args` fields are preserved for tooltip enrichment.

**Ordering.** Processes and threads are ordered by the first event's start time in each. Within each thread, events are sorted by `startTime` ascending. If no `tid` or `pid` is present, the event is assigned to process/thread `0`. Threads with uppercase/matching names are preferred for display names over integer IDs.

**Time scaling.** Source timestamps in microseconds are converted to nanoseconds for internal representation when `sourceTimeUnit` is `'us'`. When the embedded trace from `.rep` provides nanosecond timestamps (`sourceTimeUnit: 'ns'`), no conversion is applied.

**Error on empty traces.** If the trace contains no complete X events (no events with both `ts` and `dur`), `chromeTraceToSwimlane` throws a descriptive error. This ensures the swimlane never renders with zero events — an empty model would produce a confusing blank canvas with no lanes.

## Acceptance Criteria

1. **PR-SWIM-001**: chromeTraceToSwimlane produces correct process/thread/event structure from a Chrome Trace.
1. **PR-SWIM-002**: SwimThread.events sorted by startTime ascending.
1. **PR-SWIM-003**: Empty trace with no complete X events throws.
1. **PR-SWIM-004**: Overlapping events preserved in original order within each thread.
1. **PR-SWIM-005**: Processes/threads with no events excluded from the model.

## Edge Cases

- Trace with only B/E events (no X events) → throws.
- Single event → one process, one thread, one event, minTime = maxTime (handled by bounds clamp in view-state).
- Events without tid/pid → grouped under default process/thread 0.

**Dependencies:** [view-models](./view-models.spec.md).

**Open:** Q8 — Lane hierarchy; use producer thread_name as-is.
