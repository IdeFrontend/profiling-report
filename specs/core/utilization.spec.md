# Utilization

<!--
  spec-id-prefix: PR-UTIL-*
  phase: MVP
  source: src/domain/utilization.ts
  test: tests/unit/utilization.spec.ts
-->

Compute thread utilization — coverage ratio and derived utilization for time intervals.

```ts
computeThreadUtilization(events: SwimEvent[], windowStart: number, windowEnd: number): number
coveredLength(events: SwimEvent[]): number
withDerivedUtilizations(threads: SwimThread[]): SwimThread[]
```

| Parameter | Type | Description |
|-----------|------|-------------|
| events | SwimEvent[] | Thread events |
| windowStart | number | Viewport start |
| windowEnd | number | Viewport end |
| threads | SwimThread[] | Threads to annotate |

**Behavior:** computeThreadUtilization returns ratio of covered time to visible window, merging overlapping intervals. coveredLength computes total duration. withDerivedUtilizations attaches utilization to each thread.

## Acceptance Criteria

1. **PR-UTIL-001**: Merges overlapping intervals instead of double-counting.
1. **PR-UTIL-002**: Clamps utilization to visible window boundaries.

## Edge Cases

- No events in window → 0. Events entirely outside → 0. Single event covering entire window → 1.0.

**Dependencies:** [swimlane-model](./swimlane-model.spec.md).
