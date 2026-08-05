# Format Time

<!--
  spec-id-prefix: PR-TIME-*
  phase: MVP
  source: src/domain/formatTime.ts
  test: tests/unit/formatTime.spec.ts
-->

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

**Cursor formatting.** `formatCursorTime` renders absolute time from 0 as `MM:SS.mmm` (e.g., 4.456s → `00:04.456`). Negative values clamped to 0. No hour component — format is designed for kernel-scale durations.

**Unit switching.** When the user changes the time unit, all formatted times update simultaneously — axis ticks, tooltip, detail strip, cursor label. The change is purely formatting; internal precision is preserved.

## Acceptance Criteria

1. **PR-TIME-001**: 1_234_000 ns → `'1.234 ms'` / `'1234.000 µs'` / `'1234000 ns'`.
1. **PR-TIME-002**: formatAxisTime adapts decimal places to tickStepNs.
1. **PR-TIME-003**: formatCursorTime renders `MM:SS.mmm` (4_456_000_000 ns → `00:04.456`).

## Edge Cases

Zero → `'0.000 ms'`. NaN/Infinity → `'—'`. Negative cursor → clamped to 0.

## Dependencies

I-Q14 — ms/µs/ns only, no clock-cycle mode in MVP.

## Open

Future cycles unit if product requires.
