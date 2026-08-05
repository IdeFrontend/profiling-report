# DetailStrip

<!--
  spec-id-prefix: PR-STRIP-*
  phase: MVP
  source: src/ui/DetailStrip/DetailStrip.vue
  test: src/ui/DetailStrip/DetailStrip.spec.ts
-->

Fixed footer strip showing the currently selected event's name and formatted times.

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| selected | SelectedEvent | yes | — | The selected event (id, name, startTime, duration, endTime) |
| unit | TimeDisplayUnit | yes | — | Time unit for formatting |
| locale | string | no | undefined | Locale for labels |

## Behavior

**Content.** Displays the selected event's `name`, start time, duration, and end time. Times are formatted via `formatTime(ns, unit)`. The strip is always rendered when a selection is active — empty selection means the strip has no content to display and appears blank or hidden.

**Selection lifecycle.** When a user clicks an event on the swimlane canvas, the parent ProfilingReport sets `selected` to the event's `SelectedEvent` representation. The strip updates reactively. Clicking empty canvas space sets `selected` to null — the strip clears.

**Relationship with tooltip.** The tooltip shows on hover (transient, follows cursor). The detail strip shows on click/selection (persistent, fixed position). Both format times identically via the same `formatTime` function.

## Acceptance Criteria

1. **PR-STRIP-001**: Renders event name when provided with a SelectedEvent.
1. **PR-STRIP-002**: Formats times correctly in the selected unit.

## Design sketches

- [Event details](/docs/specs/ui/source/event-details.png)

**Dependencies:** [format-time](/specs/core/format-time.spec.md).
