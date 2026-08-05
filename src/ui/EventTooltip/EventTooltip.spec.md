# EventTooltip

<!--
  spec-id-prefix: PR-TOOLTIP-*
  phase: MVP
  source: src/ui/EventTooltip/EventTooltip.vue
  test: src/ui/EventTooltip/EventTooltip.spec.ts
-->

Floating tooltip on hover: event name, start, duration, end.

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| event | SwimEvent | yes | — | The hovered event |
| stylePos | { left: string; top: string } | yes | — | CSS position |
| unit | TimeDisplayUnit | yes | — | Time display unit |
| locale | string | no | undefined | Locale code |

**Behavior:** Renders name and formatted start/duration/end times. Positioned via inline styles from parent.

- [Event details](/docs/specs/ui/source/event-details.png)

## Acceptance Criteria

1. **PR-TOOLTIP-001**: Renders event name when passed a valid SwimEvent.
1. **PR-TOOLTIP-002**: Formats times correctly in ms/us/ns modes.

**Dependencies:** [format-time](/specs/core/format-time.spec.md).
