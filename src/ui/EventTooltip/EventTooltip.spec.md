# EventTooltip

<!--
  metadata
  spec-id-prefix: PR-TOOLTIP-*
  phase: MVP
  owner: -
  last-updated: 2026-08-04
  source: src/ui/EventTooltip/EventTooltip.vue
  test: src/ui/EventTooltip/EventTooltip.spec.ts
-->

## Purpose

Floating tooltip showing event details (name, start, duration, end) on hover over a swimlane event.

## Inputs / Outputs

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| event | SwimEvent | yes | — | The hovered event |
| stylePos | { left: string; top: string } | yes | — | CSS position styles |
| unit | TimeDisplayUnit | yes | — | Time display unit |
| locale | string | no | undefined | Locale code |

### Emits

None. Pure presentational component.

### Slots

None.

## Behavior

- Renders event name and formatted start/duration/end times.
- Positioned via inline styles from parent.
- Respects locale for time formatting.

## Design sketches

- [Event details](/docs/specs/ui/source/event-details.png) — hover tooltip showing event name, start, duration, end

## Acceptance Criteria

1. **PR-TOOLTIP-001**: Renders event name when passed a valid SwimEvent.
1. **PR-TOOLTIP-002**: Formats times correctly in ms/us/ns modes.

## Edge Cases

- Event without name — shows empty name field.
- stylePos with negative values — renders at given position (parent responsibility to clamp).

## Dependencies

- [specs/core/format-time.spec.md] — time formatting.

## Open Questions

- None.
