# EventTooltip

| spec-id-prefix |
|----------------|
| PR-TOOLTIP-*   |

Floating tooltip shown on hover over a swimlane event. Displays the event name and formatted time range.

## Inputs

**event** is the SwimEvent being hovered. **stylePos** carries CSS `{ left, top }` values computed by the parent from the cursor's clientX/clientY. Optional **locale** localizes labels. Times use **per-value** auto units (`formatTimeAuto` / `formatDisplayTimeAuto`) — not the viewport zoom unit.

## Outputs

Purely presentational — no emitted events. The parent controls visibility by conditionally mounting this component.

## Behavior

Displays the event's name, start time, duration, and end time. For a collapsed-group summary event (`taskCount` set), the title is **"N tasks"** instead of the (empty) event name. Each time field picks its unit from that value's magnitude (Start and Duration may differ) and shows **4** significant digits. **Unit chrome (intentional):** digits use one font size/weight across scales; units are distinguished by the suffix text only — not size- or hue-per-unit. Positioned absolutely using inline styles computed by the parent from the cursor's clientX/clientY — the tooltip itself does not manage positioning.

The parent conditionally renders the tooltip when a hovered event exists. When the cursor moves to empty space, the parent clears the hover and the tooltip is removed from DOM.

The tooltip is transient (follows cursor, appears/disappears on hover). The detail strip serves the persistent selection use case.

## Acceptance Criteria

1. **PR-TOOLTIP-001** — Renders event name.
2. **PR-TOOLTIP-002** — Formats start time, duration, and end time (4 significant digits; uniform digit chrome, unit via text).
3. **PR-TOOLTIP-003** — A summary event (`taskCount` set) shows an "N tasks" title (singular "1 task") instead of its empty name.

## Visual

Crops: [`visual/tooltip.png`](./visual/tooltip.png), [`visual/tooltip-context.png`](./visual/tooltip-context.png) — [`visual/provenance.yaml`](./visual/provenance.yaml). Time digits share one size; unit identity is the suffix string.

## Design sketches

- [tooltip](./visual/tooltip.png) — from `v930/task-hover`
- [tooltip-context](./visual/tooltip-context.png) — hovered event + tooltip from `v930/task-hover`
- [Task hover](../../../docs/ui/source/v930/task-hover.jpeg) — full frame

## Dependencies

[format-time](../../../specs/core/format-time.spec.md).

**Input formats:** [METRICS_AND_TRACE.md](../../../docs/formats/METRICS_AND_TRACE.md) (trace.json event schema — name, startTime, duration fields).

## Changelog
- **2026-09-03** — Summary events (`taskCount`) title as "N tasks" / "1 task"; PR-TOOLTIP-003.
- **2026-08-28** — Intentional: uniform digit chrome; unit via suffix text (no size/tint-by-unit).
- **2026-08-28** — Start/Dur/End display uses 4 significant digits.
- **2026-08-28** — Per-value auto units for Start/Dur/End (independent of viewport zoom); drop `timeScaleUnit` prop.
- **2026-08-10** — Recut from `v930/task-hover` (real hover tooltip dump).
- **2026-08-05** — Initial spec. Core behaviors established.
