# Utilization

<!--
  spec-id-prefix: PR-UTIL-*
  phase: MVP
  source: src/domain/utilization.ts
  test: tests/unit/utilization.spec.ts
-->

Compute thread utilization — coverage ratio of event time to visible window, and derived utilization values for gutter display.

```ts
computeThreadUtilization(events: SwimEvent[], windowStart: number, windowEnd: number): number
coveredLength(events: SwimEvent[]): number
withDerivedUtilizations(threads: SwimThread[]): SwimThread[]
```

## Behavior

**Interval merging.** `coveredLength` sorts events by start time, then iterates — if an event overlaps the current merged interval, the interval is extended; otherwise, the current interval's duration is added to the total and a new interval begins. This prevents double-counting overlapping events.

**Window utilization.** `computeThreadUtilization` clips events to the window boundaries first, then merges overlapping intervals and divides the total by the window span. Returns the fraction of the visible window covered by events.

**Thread annotation.** `withDerivedUtilizations` attaches a `utilization` number to each thread. Used by LaneGutter for percentage display.

## Acceptance Criteria

1. **PR-UTIL-001**: Merges overlapping intervals instead of double-counting.
1. **PR-UTIL-002**: Clamps utilization to visible window boundaries.

## Edge Cases

No events in window → 0. Events entirely outside → 0. Single event covering entire window → 1.0.

## Dependencies

[swimlane-model](./swimlane-model.spec.md).
