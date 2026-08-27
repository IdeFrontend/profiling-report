# Format Time

| spec-id-prefix |
|----------------|
| PR-TIME-*      |

Format internal nanosecond time values to human-readable strings for axis ticks, cursor labels, tooltips, and the detail strip.

```ts
formatTime(ns, unit?: TimeScaleUnit): string
formatTimeParts(ns, unit?): { value: string; unit: string }
formatAxisTime(ns, unit?, tickStepNs?): string
formatAxisBaseTime(ns, unit): string
formatCursorTime(ns, unit?): string
formatDisplayTime(ns, origin, unit?): string
formatDisplayTimeParts(ns, origin, unit?): { value: string; unit: string }
timeScaleUnitFromNsQuantum(quantumNs): TimeScaleUnit
resolveTimeUnitFromVisibleRange(spanNs): TimeScaleUnit
```

## Behavior

**Internal representation.** All time values throughout the system use nanoseconds internally. Conversion to display units happens only at the formatting layer.

**Auto scale.** Wall-time labels use `TimeScaleUnit` (`s` / `ms` / `us` / `ns`). Viewport chrome uses `resolveTimeUnitFromVisibleRange(end − start)`. Overview / total axis uses major-tick step from span×width (`resolveTimeUnitFromAxisDensity` in axisRuler) — brush window must not change overview unit. **No** manual ms/µs/ns dropdown and **no** CPU clock-cycle mode in this PR (cycles deferred — see [I-Q14](../../docs/context/INTERIM_DECISIONS.md#i-q14--time-auto-scale)).

**Tooltip/detail formatting.** `formatTime` shows 3 decimal places (integer ns). Values with |magnitude| ≥ 1000 use thin-space-style grouping (`1 800 000`) on the integer part so ms / µs / ns magnitudes stay distinguishable. `formatTimeParts` returns value and unit separately for the detail card (`7419` under `Start (ns)`); `formatTime` joins them. `formatDisplayTime` / `formatDisplayTimeParts` subtract a shared origin (usually `minTime`) for start/end columns.

**Axis tick formatting.** `formatAxisTime` derives one fraction-digit count from `tickStepNs` in the display unit (0 when the step is integral; otherwise the minimum digits that represent the step). Every tick on the same axis uses that precision — integral steps omit `.0` (e.g. `100ms`); fractional steps keep trailing zeros on whole ticks (e.g. `25.0ms` beside `12.5ms`). **Zero is always compact** (`0ms` / `0µs` / `0ns` / `0s`, never `0.0…`). Applies the same ≥1000 grouping. Viewport axis may subtract a coarse base (`resolveAxisBaseOffset` in axisRuler) and show remainders on ticks; the base label uses `formatAxisBaseTime` (integral only, no decimal point). Cursor/tooltip keep full `formatDisplayTime`.

**Cursor formatting.** `MM:SS.mmm` in the resolved scale (sketch: 4.456ms → `00:04.456`).

## Acceptance Criteria

1. **PR-TIME-001** — format by scale unit.
1. **PR-TIME-002** — cursor MM:SS.mmm.
1. **PR-TIME-002b** — visible-range / quantum resolvers.
1. **PR-TIME-003** — axis decimals follow tick step.
1. **PR-TIME-004** — compact axis zero.
1. **PR-TIME-005** — `formatTimeParts` and joined `formatTime`.
1. **PR-TIME-006** — `formatAxisBaseTime` integral only (no decimal point).
1. **PR-TIME-007** — axis ticks share one fraction-digit count from tick step (no mixed `146ms` / `146.1ms`).

## Edge Cases

Zero → compact `'0ms'` on axis (via PR-TIME-004); tooltip `formatTime(0)` still `'0.000 ms'`. NaN/Infinity → `'—'`. Negative cursor → clamped to 0.

## Dependencies

I-Q14 — Time (auto scale); see [INTERIM_DECISIONS I-Q14](../../docs/context/INTERIM_DECISIONS.md#i-q14--time-auto-scale).

## Changelog
- **2026-08-27** — PR-TIME-007 uniform axis fraction digits from tick step.
- **2026-08-27** — PR-TIME-006 `formatAxisBaseTime` integral-only viewport base labels.
- **2026-08-27** — Group thousands with spaces when |value| ≥ 1000.
- **2026-08-27** — Auto-scale units; remove manual dropdown; cycles mode deferred to follow-up PR.
- **2026-08-21** — Seconds support in scale unit.
- **2026-08-13** — PR-TIME-005 `formatTimeParts` for the detail card's unit-in-label layout.
- **2026-08-07** — PR-TIME-004 compact axis zero.
- **2026-08-05** — Initial spec. Core behaviors established.
