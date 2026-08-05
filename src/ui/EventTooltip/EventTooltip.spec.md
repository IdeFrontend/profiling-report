# EventTooltip

<!--
  spec-id-prefix: PR-TOOLTIP-*
  phase: MVP
  source: src/ui/EventTooltip/EventTooltip.vue
  test: src/ui/EventTooltip/EventTooltip.spec.ts
-->

Floating tooltip displayed on hover over a swimlane event. Shows event name and formatted time range.

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| event | SwimEvent | yes | — | The hovered event |
| stylePos | { left: string; top: string } | yes | — | CSS position from parent (computed from clientX/clientY) |
| unit | TimeDisplayUnit | yes | — | Time unit for formatting |
| locale | string | no | undefined | Locale for labels |

## Behavior

**Content.** Displays the event's `name`, start time, duration, and end time. Times are formatted via `formatTime(ns, unit)` — formatted in the currently selected time unit (ms/µs/ns). The tooltip uses absolute positioning within the viewer container.

**Positioning.** The parent ProfilingReport computes `stylePos` from the `hover` emit's clientX/clientY coordinates, offset to appear near the cursor. The tooltip does not manage its own positioning — it is a pure presentational layer for the position computed upstream.

**Visibility.** The tooltip is conditionally rendered by the parent via `v-if` when `hovered` is non-null. When the cursor moves to empty space, the parent sets hovered to null and the tooltip is removed from DOM.

## Acceptance Criteria

1. **PR-TOOLTIP-001**: Renders event name when passed a valid SwimEvent.
1. **PR-TOOLTIP-002**: Formats times correctly in ms/µs/ns modes.

## Design sketches

- [Event details](/docs/specs/ui/source/event-details.png)

**Dependencies:** [format-time](/specs/core/format-time.spec.md).
