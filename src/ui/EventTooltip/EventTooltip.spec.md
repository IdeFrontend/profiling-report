# EventTooltip

<!--
  spec-id-prefix: PR-TOOLTIP-*
  phase: MVP
  source: src/ui/EventTooltip/EventTooltip.vue
  test: src/ui/EventTooltip/EventTooltip.spec.ts
-->

Floating tooltip shown on hover over a swimlane event. Displays the event name and formatted time range.

## Behavior

Displays the event's name, start time, duration, and end time. Times are formatted in the currently selected display unit (ms/µs/ns). Positioned absolutely using inline styles computed by the parent from the cursor's clientX/clientY — the tooltip itself does not manage positioning.

The parent conditionally renders the tooltip when a hovered event exists. When the cursor moves to empty space, the parent clears the hover and the tooltip is removed from DOM.

The tooltip is transient (follows cursor, appears/disappears on hover). The detail strip serves the persistent selection use case.

## Acceptance Criteria

1. **PR-TOOLTIP-001** — Renders event name.
2. **PR-TOOLTIP-002** — Formats start time, duration, and end time.

## Design sketches

- [Event details](/docs/specs/ui/source/event-details.png)

## Dependencies

[format-time](/specs/core/format-time.spec.md).
