# DetailStrip

| spec-id-prefix |
|----------------|
| PR-STRIP-*     |

Fixed footer strip showing the currently selected event's name and formatted times. Persists until the user clicks empty space.

## Inputs

**selected** is a `SelectedEvent` (id, name, startTime, duration, endTime) representing the currently selected event. **unit** selects the time display unit. Optional **locale** localizes labels. The parent conditions the component on `v-if="selected && showTimeline"` — when no event is selected, the strip is unmounted.

## Outputs

Purely presentational — no emitted events.

## Behavior

Displays the selected event's name, start time, duration, and end time in the current display unit. The selection lifecycle is managed by the parent ProfilingReport: click on an event → selection is set → the strip appears; click on empty canvas → selection cleared → the strip hides.

The detail strip is the persistent counterpart to the event tooltip: tooltip is transient (follows cursor on hover), detail strip is fixed (shows selected event until explicitly cleared).

## Acceptance Criteria

1. **PR-STRIP-001** — Renders event name.
2. **PR-STRIP-002** — Formats start time, duration, and end time.

## Visual

Normative crops: [`visual/strip.png`](./visual/strip.png), [`visual/strip-context.png`](./visual/strip-context.png) — [`visual/provenance.yaml`](./visual/provenance.yaml).

## Design sketches

- [strip](./visual/strip.png) — from `v930/detail-strip-raised`
- [strip-context](./visual/strip-context.png) — from `v930/detail-strip-raised`
- [Event details](../../../docs/ui/source/v930/detail-strip-raised.jpeg) — full frame

## Dependencies

[format-time](../../../specs/core/format-time.spec.md).

**Input formats:** [METRICS_AND_TRACE.md](../../../docs/formats/METRICS_AND_TRACE.md) (trace.json event schema — SelectedEvent fields).

## Changelog
- **2026-08-05** — Initial spec. Core behaviors established.
