# Utilization

| spec-id-prefix |
|----------------|
| PR-UTIL-*      |

Compute thread utilization — coverage ratio of event time to visible window, and derived utilization values for gutter display.

```ts
computeThreadUtilization(thread: SwimThread, minTime: number, maxTime: number): number
coveredLength(intervals: Array<{ start: number; end: number }>): number
withDerivedUtilizations(model: SwimlaneModel): SwimlaneModel
isRatioUtilizationKey(seriesKey: string): boolean
timeWeightedCounterMean(points, minTime, maxTime): number | undefined
counterUtilizationFraction(thread, minTime, maxTime): number | undefined
```

## Behavior

**Interval merging.** `coveredLength` sorts events by start time, then iterates — if an event overlaps the current merged interval, the interval is extended; otherwise, the current interval's duration is added to the total and a new interval begins. This prevents double-counting overlapping events.

**Window utilization.** `computeThreadUtilization` takes a `SwimThread` and clips each event to the window, then merges overlapping intervals and divides by span. Returns the fraction (0–1) of the visible window covered by events.

**Thread annotation.** `withDerivedUtilizations` takes a `SwimlaneModel`, iterates processes and threads, and fills any missing `utilization` field using the model's time range. Counter leaves keep derived coverage at 0 when `events` are empty — gutter bars for counters use `counterUtilizationFraction` instead ([DATA-59](../../docs/context/decisions/DATA.md)).

**Counter ratio keys ([DATA-59](../../docs/context/decisions/DATA.md)).** `isRatioUtilizationKey` is true when the series key contains `%`, or matches `utilization` / `利用率`, except queue-depth / bytes keys (`queue`, `KB`, `bytes`) which are never ratio. Classify by the leaf `name`.

**Time-weighted counter mean.** `timeWeightedCounterMean` holds each step-after sample until the next (last sample holds to `maxTime`), clips segments to `[minTime, maxTime]`, and returns Σ(v·Δt)/Σ(Δt). Empty / no overlap → `undefined`.

**Counter utilization fraction.** `counterUtilizationFraction` returns a 0–1 fraction for gutter `barWidth` when the leaf has `counter` and a ratio key: time-weighted mean scaled to percent (`yMax ≤ 1` → treat as 0–1 fraction ×100; else already-percent), then `/100`, clamped 0–1. Absolute counters → `undefined` (no bar).

## Acceptance Criteria

1. **PR-UTIL-001** — Merges overlapping intervals instead of double-counting.
1. **PR-UTIL-002** — Clamps utilization to visible window boundaries.
1. **PR-UTIL-003** — Zero-duration events contribute no coverage.
1. **PR-UTIL-004** — Ratio key heuristic excludes queue/bytes.
1. **PR-UTIL-005** — Time-weighted mean holds step-after across gaps.
1. **PR-UTIL-006** — Counter util fraction scales by yMax ≤1 vs already-percent.

## Edge Cases

No events in window → 0. Events entirely outside → 0. Single event covering entire window → 1.0. Zero-duration events (`end <= start`, e.g. instant `ph:i` ticks — #205) contribute no coverage. Absolute counter leaf → `undefined` fraction. Counter with no samples overlapping the window → `undefined`.

## Dependencies

[swimlane-model](./swimlane-model.spec.md), [DATA-59](../../docs/context/decisions/DATA.md).

## Changelog
- **2026-11-25** — DATA-59: counter ratio keys, time-weighted mean, util fraction (PR-UTIL-004…006).
- **2026-11-18** — #205 / PR-UTIL-003: document that duration-0 ticks add no util coverage.
- **2026-08-05** — Initial spec. Core behaviors established.
