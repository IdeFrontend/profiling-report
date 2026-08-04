# Utilization

<!--
  metadata
  spec-id-prefix: PR-UTIL-*
  phase: MVP
  owner: -
  last-updated: 2026-08-04
  source: src/core/utilization.ts
  test: tests/unit/utilization.spec.ts
-->

## Purpose

Compute thread utilization metrics — coverage ratio and derived utilization values for time intervals.

## Inputs / Outputs

```ts
computeThreadUtilization(events: SwimEvent[], windowStart: number, windowEnd: number): number
coveredLength(events: SwimEvent[]): number
withDerivedUtilizations(threads: SwimThread[]): SwimThread[]
```

| Parameter | Type | Description |
|-----------|------|-------------|
| events | SwimEvent[] | Thread events |
| windowStart | number | Viewport start (us) |
| windowEnd | number | Viewport end (us) |
| threads | SwimThread[] | Threads to annotate |

## Behavior

- computeThreadUtilization returns ratio of covered time to visible window.
- coveredLength computes total duration covered by events (merging overlaps).
- withDerivedUtilizations attaches utilization values to each thread.

## Acceptance Criteria

1. Merges overlapping intervals instead of double-counting.
1. Clamps utilization to the visible window boundaries.

## Edge Cases

- No events in window — returns 0.
- Events entirely outside window — returns 0.
- Single event covering entire window — returns 1.0.
- Dense overlapping events — correctly merged.

## Dependencies

- [specs/core/swimlane-model.spec.md] — SwimEvent, SwimThread types.

## Open Questions

- None.
