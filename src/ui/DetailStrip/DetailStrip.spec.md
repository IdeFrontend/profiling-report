# DetailStrip

<!--
  metadata
  spec-id-prefix: PR-STRIP-*
  phase: MVP
  owner: -
  last-updated: 2026-08-04
  source: src/ui/DetailStrip/DetailStrip.vue
  test: src/ui/DetailStrip/DetailStrip.spec.ts
-->

## Purpose

Bottom detail strip showing selected event name and formatted times.

## Inputs / Outputs

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| selected | SelectedEvent | yes | — | The selected event |
| unit | TimeDisplayUnit | yes | — | Time display unit |
| locale | string | no | undefined | Locale code |

### Emits

None. Pure presentational.

## Behavior

- Renders selected event name and start/duration/end times.
- Formatted times respect the selected unit.

## Acceptance Criteria

1. **PR-STRIP-001**: Renders event name when provided with selected event.
1. **PR-STRIP-002**: Formats times correctly in the selected unit.

## Edge Cases

- Selected event with empty name — shows empty name.

## Dependencies

- [specs/core/format-time.spec.md] — time formatting.

## Open Questions

- None.
