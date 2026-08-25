# EventTooltip

| spec-id-prefix |
|----------------|
| PR-TOOLTIP-*   |

Floating tooltip shown on hover over a swimlane event. Displays the event name and formatted time range.

## Inputs

**event** is the SwimEvent being hovered. **stylePos** carries CSS `{ left, top }` values computed by the parent from the cursor's clientX/clientY. **unit** selects the time display unit. **timeOrigin** (usually `model.minTime`) offsets Start/End labels; duration is absolute. Optional **locale** localizes labels.

## Outputs

Purely presentational — no emitted events. The parent controls visibility by conditionally mounting this component.

## Behavior

Displays the event's name, start time, duration, and end time. Start/End use `formatDisplayTime(…, timeOrigin)` so they match the cursor at the event edge (shared display origin = `minTime`, PyPTO / Perfetto default). Duration uses `formatTime` without origin. Formatted in the currently selected display unit (ms/µs/ns). Positioned absolutely using inline styles computed by the parent from the cursor's clientX/clientY — the tooltip itself does not manage positioning.

The parent conditionally renders the tooltip when a hovered event exists. When the cursor moves to empty space, the parent clears the hover and the tooltip is removed from DOM.

The tooltip is transient (follows cursor, appears/disappears on hover). The detail strip serves the persistent selection use case.

## Acceptance Criteria

1. **PR-TOOLTIP-001** — Renders event name.
2. **PR-TOOLTIP-002** — Formats start time, duration, and end time.
3. **PR-TOOLTIP-003** — Start time is relative to `timeOrigin` and matches the cursor label at the event edge.

## Edge Cases

Very long event names — truncated with ellipsis. Tooltip near viewport edges — parent clamps position to stay visible.

## Dependencies

[format-time](../../../specs/core/format-time.spec.md).

## Changelog
- **2026-08-25** — Start/End relative to timeOrigin (shared with cursor).
- **2026-08-24** — Producer timestamp start/end (matches cursor); PR-TOOLTIP-003.
