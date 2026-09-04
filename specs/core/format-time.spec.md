# Format Time

| spec-id-prefix |
|----------------|
| PR-TIME-*      |

Format internal nanosecond time values to human-readable strings for axis ticks, cursor labels, tooltips, and the detail strip.

```ts
formatTime(ns, unit?: TimeScaleUnit): string
formatTimeParts(ns, unit?): { value: string; unit: string }
formatTimeAuto(ns): string
formatTimePartsAuto(ns): { value: string; unit: string }
formatAxisTime(ns, unit?, tickStepNs?): string
formatAxisBaseTime(ns, unit): string
formatCursorTime(ns, unit?): string
formatDisplayTime(ns, origin, unit?): string
formatDisplayTimeParts(ns, origin, unit?): { value: string; unit: string }
formatDisplayTimeAuto(ns, origin): string
formatDisplayTimePartsAuto(ns, origin): { value: string; unit: string }
timeScaleUnitFromNsQuantum(quantumNs): TimeScaleUnit
timeScaleUnitFromMagnitude(ns): TimeScaleUnit
resolveTimeUnitFromVisibleRange(spanNs): TimeScaleUnit
```

## Behavior

**Internal representation.** All time values throughout the system use nanoseconds internally. Conversion to display units happens only at the formatting layer.

**Two-tier auto scale** ([UI-40a](../../docs/context/decisions/interim/UI.md)). Wall-time labels use `TimeScaleUnit` (`s` / `ms` / `us` / `ns`).

- **Spatial chrome** (viewport axis, cursor timestamp, overview axis): share a viewport / density unit — `resolveTimeUnitFromVisibleRange(end − start)` for viewport chrome; overview / total axis uses major-tick step from span×width (`resolveTimeUnitFromAxisDensity` in axisRuler) — brush window must not change overview unit.
- **Absolute event times** (tooltip / detail Start·End·Duration) and **measure / gap Δt**: each value picks its own unit via `timeScaleUnitFromMagnitude` / `formatTimeAuto` (PyPTO-like) — **independent of zoom**. Start and Duration may use different units.

**No** manual ms/µs/ns dropdown and **no** CPU clock-cycle mode in this PR (cycles deferred).

**Tooltip/detail formatting.** `formatTime` / `formatTimeParts` take an explicit unit (chrome callers). Surfaces that must not follow zoom use `formatTimeAuto` / `formatTimePartsAuto` / `formatDisplayTimeAuto` / `formatDisplayTimePartsAuto`. Event tooltip and detail **value cells** pass `significantDigits: 4` (`EVENT_TIME_SIGNIFICANT_DIGITS`); detail **hover titles** omit that option and keep full fixed-decimal precision. Values with |magnitude| ≥ 1000 use thin-space-style grouping (`1 800 000`) on the integer part. `formatTimeParts*` returns value and unit separately for the detail card; joined helpers add a space. **Presentation chrome** (detail / tooltip) keeps one digit size/weight across scales; unit identity is the suffix string — formatting does not encode unit via size or color.

**Axis tick formatting.** `formatAxisTime` derives one fraction-digit count from `tickStepNs` in the display unit (0 when the step is integral; otherwise the minimum digits that represent the step). Every tick on the same axis uses that precision — integral steps omit `.0` (e.g. `100ms`); fractional steps keep trailing zeros on whole ticks (e.g. `25.0ms` beside `12.5ms`). **Zero is always compact** (`0ms` / `0µs` / `0ns` / `0s`, never `0.0…`). Applies the same ≥1000 grouping. Viewport axis may subtract a coarse base (`resolveAxisBaseOffset` in axisRuler) and show remainders on ticks; the base label uses `formatAxisBaseTime` (integral only, no decimal point). Cursor keeps full `formatDisplayTime` in the viewport unit.

**Cursor formatting.** `MM:SS.mmm` in the resolved scale (sketch: 4.456ms → `00:04.456`) — API helper; UI cursor pill uses scalar `formatDisplayTime` in the viewport unit.

## Acceptance Criteria

1. **PR-TIME-001** — format by scale unit.
1. **PR-TIME-002** — cursor MM:SS.mmm.
1. **PR-TIME-002b** — visible-range / quantum resolvers.
1. **PR-TIME-003** — axis decimals follow tick step.
1. **PR-TIME-004** — compact axis zero.
1. **PR-TIME-005** — `formatTimeParts` and joined `formatTime`.
1. **PR-TIME-006** — `formatAxisBaseTime` integral only (no decimal point).
1. **PR-TIME-007** — axis ticks share one fraction-digit count from tick step (no mixed `146ms` / `146.1ms`).
1. **PR-TIME-008** — `formatTimeAuto` / magnitude unit: tooltip/detail/Δt independent of viewport unit.
1. **PR-TIME-009** — Event tooltip / detail value cells use **4** significant digits; detail hover titles keep full precision.

## Edge Cases

Zero → compact `'0ms'` on axis (via PR-TIME-004); tooltip `formatTimeAuto(0)` → `'0 ns'`. NaN/Infinity → `'—'`. Negative cursor → clamped to 0.

## Dependencies

UI-40a — Time (auto scale); see [UI-40a](../../docs/context/decisions/interim/UI.md).

## Changelog
- **2026-08-28** — Document uniform digit chrome for event times (no size/tint-by-unit); unit via suffix.
- **2026-08-28** — PR-TIME-009 event start/end/duration display: 4 significant digits; detail titles stay full precision.
- **2026-08-28** — PR-TIME-008 two-tier auto: chrome from viewport/density; tooltip/detail/Δt per-value.
- **2026-08-27** — PR-TIME-007 uniform axis fraction digits from tick step.
- **2026-08-27** — PR-TIME-006 `formatAxisBaseTime` integral-only viewport base labels.
- **2026-08-27** — Group thousands with spaces when |value| ≥ 1000.
- **2026-08-27** — Auto-scale units; remove manual dropdown; cycles mode deferred to follow-up PR.
- **2026-08-21** — Seconds support in scale unit.
- **2026-08-13** — PR-TIME-005 `formatTimeParts` for the detail card's unit-in-label layout.
- **2026-08-07** — PR-TIME-004 compact axis zero.
- **2026-08-05** — Initial spec. Core behaviors established.
