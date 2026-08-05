# DetailStrip

<!--
  spec-id-prefix: PR-STRIP-*
  phase: MVP
  source: src/ui/DetailStrip/DetailStrip.vue
  test: src/ui/DetailStrip/DetailStrip.spec.ts
-->

Fixed footer strip showing the currently selected event's name and formatted times. Persists until the user clicks empty space.

## Behavior

Displays the selected event's name, start time, duration, and end time in the current display unit. The selection lifecycle is managed by the parent ProfilingReport: click on an event → selection is set → the strip appears; click on empty canvas → selection cleared → the strip hides.

The detail strip is the persistent counterpart to the event tooltip: tooltip is transient (follows cursor on hover), detail strip is fixed (shows selected event until explicitly cleared).

## Acceptance Criteria

1. **PR-STRIP-001** — Renders event name.
2. **PR-STRIP-002** — Formats start time, duration, and end time.

## Design sketches

- [Event details](/docs/specs/ui/source/event-details.png)

## Dependencies

[format-time](/specs/core/format-time.spec.md).
