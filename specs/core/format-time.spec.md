# Format Time

<!--
  spec-id-prefix: PR-TIME-*
  phase: MVP
  source: src/domain/formatTime.ts
  test: tests/unit/formatTime.spec.ts
-->

Format internal nanosecond time values to human-readable strings in ms, µs, or ns for axis ticks, cursor labels, tooltips, and the detail strip.

```ts
formatTime(ns: number, unit: TimeDisplayUnit): string
formatAxisTime(ns: number, unit: TimeDisplayUnit, tickStepNs?: number): string
formatCursorTime(ns: number): string
```

## Behavior

**Internal representation.** All time values throughout the system are stored in nanoseconds. Conversion to display units (ms/µs/ns) happens only at the formatting layer. This avoids precision loss from intermediate conversions and ensures consistent display regardless of input format (the embedded Chrome Trace in `.rep` uses nanosecond timestamps).

**Tooltip and detail formatting.** `formatTime(ns, unit)` divides by 1e3 for µs or 1e6 for ms, displaying 3 decimal places for µs/ms, integer for ns. The `—` character is used for NaN/Infinity values.

**Axis tick formatting.** `formatAxisTime` adapts decimal places based on tick spacing to prevent zoomed axes from collapsing to identical labels. When `tickStepNs` is provided, decimal places follow the tick step: >=1 → 1 decimal, >=0.1 → 2, >=0.01 → 3, >=0.001 → 4, otherwise 5.

**Cursor formatting.** `formatCursorTime` renders absolute time from 0 as `MM:SS.mmm` (e.g., 4.456s → `00:04.456`). Negative values are clamped to 0. Values exceeding 99 minutes are displayed as-is (no hour component — the format is designed for kernel-scale durations).

**Unit switching.** When the user changes the time unit in the toolbar, all formatted times across the UI update simultaneously — axis ticks, tooltip, detail strip, and cursor label. The change is purely formatting; internal precision is preserved.

## Acceptance Criteria

1. **PR-TIME-001**: 1_234_000 ns → `'1.234 ms'` / `'1234.000 µs'` / `'1234000 ns'`.
1. **PR-TIME-002**: formatAxisTime with tickStepNs adapts decimal places to tick spacing.
1. **PR-TIME-003**: formatCursorTime renders `MM:SS.mmm` (4_456_000_000 ns → `00:04.456`).

## Edge Cases

- Zero → `'0.000 ms'` or equivalent. NaN/Infinity → `'—'`. Negative in cursor → clamped to 0.

**Dependencies:** I-Q14 — ms/µs/ns only, no clock-cycle mode in MVP.

**Open:** Future cycles unit if product requires.
