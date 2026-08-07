# Format Time

| spec-id-prefix |
|----------------|
| PR-TIME-*      |

Format internal nanosecond time values to human-readable strings for axis ticks, cursor labels, tooltips, and the detail strip.

```ts
formatTime(ns: number, unit: TimeDisplayUnit): string
formatAxisTime(ns: number, unit: TimeDisplayUnit, tickStepNs?: number): string
formatCursorTime(ns: number): string
```

## Behavior

**Internal representation.** All time values throughout the system use nanoseconds internally. Conversion to display units happens only at the formatting layer. This avoids precision loss from intermediate conversions.

**Tooltip/detail formatting.** `formatTime` divides by 1e3 (µs) or 1e6 (ms), displaying 3 decimal places. NaN/Infinity → `—`. Integer display for ns.

**Axis tick formatting.** `formatAxisTime` adapts decimal places based on `tickStepNs` to prevent zoomed axes from collapsing to identical labels. Step ≥1 → 1 decimal, ≥0.1 → 2, ≥0.01 → 3, ≥0.001 → 4, otherwise 5.

**Cursor formatting.** `formatCursorTime(ns, unit)` renders the value in `unit` as `MM:SS.mmm` (sketch: 4.456ms → `00:04.456`). Negative values clamped to 0. No hour component. `resolveCursorTimeUnit(spanNs, preferred)` picks `us`/`ns` when the trace span is sub-ms so short kernel fixtures still update the label while moving.

**Unit switching.** When the user changes the time unit, all formatted times update simultaneously — axis ticks, tooltip, detail strip, cursor label. The change is purely formatting; internal precision is preserved.

## Acceptance Criteria

1. **PR-TIME-001**: 1_234_000 ns → `'1.234 ms'` / `'1234.000 µs'` / `'1234000 ns'`.
1. **PR-TIME-002**: formatCursorTime renders `MM:SS.mmm` in unit (4_456_000 ns + ms → `00:04.456`).
1. **PR-TIME-003**: formatAxisTime adapts decimal places to tickStepNs.
1. **PR-TIME-004**: formatAxisTime(0) is compact zero (`0ms` / `0µs` / `0ns`).

## Edge Cases

Zero → compact `'0ms'` on axis (via PR-TIME-004); tooltip `formatTime(0)` still `'0.000 ms'`. NaN/Infinity → `'—'`. Negative cursor → clamped to 0.

## Dependencies

I-Q14 — ms/µs/ns only, no clock-cycle mode in MVP.

## Open

Future cycles unit if product requires.

## Changelog
- **2026-08-07** — PR-TIME-004 compact axis zero; cursor unit resolution for short spans.
- **2026-08-07** — Cursor format uses display unit (sketch ms→clock); resolveCursorTimeUnit for short spans.
- **2026-08-05** — Initial spec. Core behaviors established.
