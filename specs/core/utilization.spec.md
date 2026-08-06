# Utilization

| spec-id-prefix |
|----------------|
| PR-UTIL-*      |

Compute thread utilization — coverage ratio of event time to visible window, and derived utilization values for gutter display.

```ts
computeThreadUtilization(thread: SwimThread, minTime: number, maxTime: number): number
coveredLength(intervals: Array<{ start: number; end: number }>): number
withDerivedUtilizations(model: SwimlaneModel): SwimlaneModel
```

## Behavior

**Interval merging.** `coveredLength` sorts events by start time, then iterates — if an event overlaps the current merged interval, the interval is extended; otherwise, the current interval's duration is added to the total and a new interval begins. This prevents double-counting overlapping events.

**Window utilization.** `computeThreadUtilization` takes a `SwimThread` and clips each event to the window, then merges overlapping intervals and divides by span. Returns the fraction (0–1) of the visible window covered by events.

**Thread annotation.** `withDerivedUtilizations` takes a `SwimlaneModel`, iterates processes and threads, and fills any missing `utilization` field using the model's time range.

## Acceptance Criteria

1. **PR-UTIL-001**: Merges overlapping intervals instead of double-counting.
1. **PR-UTIL-002**: Clamps utilization to visible window boundaries.

## Edge Cases

No events in window → 0. Events entirely outside → 0. Single event covering entire window → 1.0.

## Dependencies

[swimlane-model](./swimlane-model.spec.md).

## Changelog
- **2026-08-05** — Initial spec. Core behaviors established.
