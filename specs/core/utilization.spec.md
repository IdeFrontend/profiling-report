# Utilization

<!--
  spec-id-prefix: PR-UTIL-*
  phase: MVP
  source: src/domain/utilization.ts
  test: tests/unit/utilization.spec.ts
-->

Compute thread utilization metrics — coverage ratio of event time to visible window, and derived utilization values for gutter display.

```ts
computeThreadUtilization(events: SwimEvent[], windowStart: number, windowEnd: number): number
coveredLength(events: SwimEvent[]): number
withDerivedUtilizations(threads: SwimThread[]): SwimThread[]
```

## Behavior

**Covered length.** `coveredLength(events)` computes the total duration covered by a set of events, merging overlapping intervals to avoid double-counting. Events are first sorted by start time, then iterated — if an event's start falls within the current merged interval, the interval is extended; otherwise, the current interval's duration is added to the total and a new interval begins.

**Window utilization.** `computeThreadUtilization(events, windowStart, windowEnd)` computes the ratio of covered event time within the visible window to the window span. Events are clipped to the window boundaries first (start = max(event.start, windowStart), end = min(event.end, windowEnd)), then overlapping intervals are merged and the total is divided by (windowEnd - windowStart).

**Thread annotation.** `withDerivedUtilizations(threads)` attaches a `utilization` number to each thread by calling `computeThreadUtilization` on the thread's events with the full timeline bounds. The result is written to `thread.utilization` and used by LaneGutter for percentage display.

## Acceptance Criteria

1. **PR-UTIL-001**: Merges overlapping intervals instead of double-counting.
1. **PR-UTIL-002**: Clamps utilization to visible window boundaries.

## Edge Cases

- No events in window → 0.
- Events entirely outside window → 0.
- Single event covering entire window → 1.0.
- Dense overlapping events → correctly merged (not summed).

**Dependencies:** [swimlane-model](./swimlane-model.spec.md).
