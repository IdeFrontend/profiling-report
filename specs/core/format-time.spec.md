# Format Time

<!--
  spec-id-prefix: PR-TIME-*
  phase: MVP
  source: src/domain/formatTime.ts
  test: tests/unit/formatTime.spec.ts
-->

Format nanosecond time values to human-readable strings in ms, µs, or ns.

```ts
formatTime(ns: number, unit: TimeDisplayUnit): string
formatAxisTime(ns: number, unit: TimeDisplayUnit, tickStepNs?: number): string
formatCursorTime(ns: number): string
```

| Parameter | Type | Description |
|-----------|------|-------------|
| ns | number | Time in nanoseconds |
| unit | TimeDisplayUnit | `'ms'`, `'us'`, `'ns'` |

**Behavior:** Converts across ms/µs/ns from internal nanosecond representation. Axis times: compact with adaptive decimal places via `tickStepNs`. Cursor times: `MM:SS.mmm` from absolute ns. No cycles in MVP per I-Q14.

## Acceptance Criteria

1. **PR-TIME-001**: 1_234_000 ns → `'1.234 ms'` / `'1234.000 µs'` / `'1234000 ns'`.
1. **PR-TIME-002**: formatAxisTime with tickStepNs adapts decimal places to tick spacing.
1. **PR-TIME-003**: formatCursorTime renders `MM:SS.mmm` (e.g. 4_456_000_000 ns → `00:04.456`).

## Edge Cases

- Zero → `'0.000 ms'`. NaN/Infinity → `'—'`. Negative in cursor → clamped to 0.

**Dependencies:** I-Q14.

**Open:** Future cycles unit if product requires it.
