# DetailStrip

<!--
  spec-id-prefix: PR-STRIP-*
  phase: MVP
  source: src/ui/DetailStrip/DetailStrip.vue
  test: src/ui/DetailStrip/DetailStrip.spec.ts
-->

Bottom detail strip: selected event name and formatted times.

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| selected | SelectedEvent | yes | — | The selected event |
| unit | TimeDisplayUnit | yes | — | Time display unit |
| locale | string | no | undefined | Locale code |

- [Event details](/docs/specs/ui/source/event-details.png)

## Acceptance Criteria

1. **PR-STRIP-001**: Renders event name when provided with selected event.
1. **PR-STRIP-002**: Formats times correctly in selected unit.

**Dependencies:** [format-time](/specs/core/format-time.spec.md).
