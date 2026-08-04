# Format Time

<!--
  metadata
  spec-id-prefix: PR-TIME-*
  phase: MVP
  owner: -
  last-updated: 2026-08-04
  source: src/core/formatTime.ts
  test: tests/unit/formatTime.spec.ts
-->

## Purpose

Format time values in microseconds to human-readable strings in ms, us, or ns.

## Inputs / Outputs

```ts
formatTime(valueUs: number, unit: TimeUnit): string
formatAxisTime(valueUs: number, unit: TimeUnit): string
formatCursorTime(valueUs: number, unit: TimeUnit): string
```

| Parameter | Type | Description |
|-----------|------|-------------|
| valueUs | number | Time value in microseconds |
| unit | TimeUnit | `'ms'`, `'us'`, or `'ns'` |

**Returns**: Formatted string with appropriate precision.

## Behavior

- Converts across ms/us/ns per selected unit.
- Axis times use compact format.
- Cursor times use full precision format.
- No cycles unit in MVP per I-Q14.

## Acceptance Criteria

1. **PR-TIME-001**: Formats 1234 us as `'1.234 ms'` in ms mode, `'1234 us'` in us mode, `'1234000 ns'` in ns mode.

## Edge Cases

- Zero value — displays as `'0'` with appropriate unit.
- Very small values — sub-microsecond displays correctly in ns mode.
- Very large values — no overflow, displayed in ms with reasonable precision.

## Dependencies

- [docs/context/INTERIM_DECISIONS.md I-Q14] — ms/us/ns only, no cycles.

## Open Questions

- Future addition of cycles unit when product requires it.
