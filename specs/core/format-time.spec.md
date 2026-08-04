# Format Time

<!--
  metadata
  spec-id-prefix: PR-TIME-*
  phase: MVP
  owner: -
  last-updated: 2026-08-04
  source: src/domain/formatTime.ts
  test: tests/unit/formatTime.spec.ts
-->

## Purpose

Format time values in nanoseconds to human-readable strings in ms, us, or ns.

## Inputs / Outputs

```ts
formatTime(ns: number, unit: TimeDisplayUnit): string
formatAxisTime(ns: number, unit: TimeDisplayUnit, tickStepNs?: number): string
formatCursorTime(ns: number): string
```

| Parameter | Type | Description |
|-----------|------|-------------|
| ns | number | Time value in nanoseconds |
| unit | TimeDisplayUnit | `'ms'`, `'us'`, or `'ns'` |

**Returns**: Formatted string with appropriate precision.

## Behavior

- Converts across ms/us/ns from the internal nanosecond representation.
- Axis times use compact format with adaptive decimal places via `tickStepNs`.
- Cursor times use `MM:SS.mmm` format from absolute nanoseconds.
- No cycles unit in MVP per I-Q14.

## Acceptance Criteria

1. **PR-TIME-001**: Formats 1_234_000 ns as `'1.234 ms'` in ms mode, `'1234.000 us'` in us mode, `'1234000 ns'` in ns mode.
1. **PR-TIME-002**: `formatAxisTime` with `tickStepNs` adapts decimal places to tick spacing.
1. **PR-TIME-003**: `formatCursorTime` renders as `MM:SS.mmm` (e.g. 4_456_000_000 ns → `00:04.456`).

## Edge Cases

- Zero value — displays as `'0.000 ms'` or equivalent.
- NaN/Infinity — displays as `'—'`.
- Negative values in cursor time — clamped to 0.

## Dependencies

- [docs/context/INTERIM_DECISIONS.md I-Q14] — ms/us/ns only, no cycles.

## Open Questions

- Future addition of cycles unit when product requires it.
