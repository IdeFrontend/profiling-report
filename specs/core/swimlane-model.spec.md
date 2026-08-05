# Swimlane Model

<!--
  spec-id-prefix: PR-SWIM-*
  phase: MVP
  source: src/domain/types.ts, src/adapters/chromeTraceToSwimlane.ts
  test: tests/unit/swimlaneModel.spec.ts
-->

Canonical types and Chrome Trace conversion logic for timeline data driving the swimlane renderer.

```ts
interface SwimlaneModel { processes: SwimProcess[]; minTime: number; maxTime: number; }
interface SwimProcess  { id: string; name: string; threads: SwimThread[]; }
interface SwimThread   { id: string; name: string; events: SwimEvent[]; utilization?: number; }
interface SwimEvent    { id: string; name: string; startTime: number; duration: number; args?: {} }
```

## Unit contract

**All time values — `minTime`, `maxTime`, `startTime`, `duration`, `SwimlaneViewWindow`, and `SwimlaneViewState` time fields — are in nanoseconds.** Conversion to display units (ms/µs/ns) happens only at the formatting layer (`formatTime`, `formatAxisTime`, `formatCursorTime`). If a new time-carrying field is introduced, it must use nanoseconds unless explicitly documented otherwise. This contract prevents the most common class of time-related bugs: mixing units across layers.

`chromeTraceToSwimlane` handles input conversion: source timestamps in microseconds (`sourceTimeUnit: 'us'`, the CTEF default) are converted to nanoseconds by multiplying by 1000. When the `.rep`-embedded trace provides nanosecond timestamps (`sourceTimeUnit: 'ns'`), no conversion is applied.

## Behavior

**Chrome Trace conversion.** `chromeTraceToSwimlane` groups complete X events (`ph: 'X'`, with `ts` and `dur`) by process ID and thread ID. Each event becomes a `SwimEvent` with `id`, `name`, `startTime`, `duration`. Optional `cat` and `args` are preserved for tooltip enrichment. Events without `tid`/`pid` are assigned to default process/thread 0.

**Ordering.** Processes and threads ordered by first event start time. Within each thread, events sorted by `startTime` ascending. Processes/threads with no events are excluded.

**Error on empty.** If the trace contains no complete X events, `chromeTraceToSwimlane` throws. This prevents the swimlane from rendering with zero events — an empty model would produce a confusing blank canvas.

## Acceptance Criteria

1. **PR-SWIM-001**: Correct process/thread/event structure from a Chrome Trace.
1. **PR-SWIM-002**: Events sorted by startTime ascending within each thread.
1. **PR-SWIM-003**: Empty trace with no X events throws.
1. **PR-SWIM-004**: Overlapping events preserved in original order.
1. **PR-SWIM-005**: Processes/threads with no events excluded.

## Edge Cases

- Only B/E events (no X) → throws. Single event → one process/thread/event, minTime = maxTime (handled upstream by bounds clamp).

## Dependencies

[view-models](./view-models.spec.md).

## Open

Q8 — Lane hierarchy; use producer thread_name as-is.

## Changelog
- **2026-08-05** — Initial spec. Core behaviors established.
