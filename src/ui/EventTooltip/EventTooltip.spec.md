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

Displays the event's name and time fields. **Interval events** (`duration > 0`) show start, duration, and end. **Instant zero-duration ticks** (`duration === 0`, #205) replace those three rows with a single bare formatted time (same zoom-aware formatting as start/end — no `Timestamp:` label). For a multi-task collapsed-group summary (`taskCount` > 1), the title is **"N tasks"** instead of the empty event name. A **single-event** summary keeps the real leaf event name as the title and shows the **source lane name** (`laneName`) under it — the leaf lane is hidden while the folder is collapsed. Each time field picks its unit from that value's magnitude (Start and Duration may differ). **Duration** shows **4** significant digits; **start / end / instant time** use viewport `nsPerPx` for zoom-aware fraction digits (same as playhead; fall back to 4 significant digits when `nsPerPx` is omitted). **Unit chrome (intentional):** digits use one font size/weight across scales; units are distinguished by the suffix text only — not size- or hue-per-unit. Positioned absolutely using inline styles computed by the parent from the cursor's clientX/clientY — the tooltip itself does not manage positioning.

The parent conditionally renders the tooltip when a hovered event exists. When the cursor moves to empty space, the parent clears the hover and the tooltip is removed from DOM.

The tooltip is transient (follows cursor, appears/disappears on hover). The detail strip serves the persistent selection use case.

## Acceptance Criteria

1. **PR-TOOLTIP-001** — Renders event name.
2. **PR-TOOLTIP-002** — Formats start time, duration, and end time (duration: 4 significant digits; start/end: `nsPerPx` digits when provided; uniform digit chrome, unit via text).
3. **PR-TOOLTIP-003** — A multi-task summary (`taskCount` > 1) shows an "N tasks" title; a single-event summary (`taskCount` === 1 with a name) shows the real event name instead of "1 task".
4. **PR-TOOLTIP-004** — A single-event summary with `laneName` shows that source lane title under the event name.
5. **PR-TOOLTIP-005** — A zero-duration event shows one bare formatted time (no `Timestamp:` / Start / Duration / End).

## Visual

Crops: [`visual/tooltip.png`](./visual/tooltip.png), [`visual/tooltip-context.png`](./visual/tooltip-context.png) — [`visual/provenance.yaml`](./visual/provenance.yaml). Time digits share one size; unit identity is the suffix string.

## Design sketches

- [tooltip](./visual/tooltip.png) — from `v930/task-hover`
- [tooltip-context](./visual/tooltip-context.png) — hovered event + tooltip from `v930/task-hover`
- [Task hover](../../../docs/ui/source/930/TaskHover/screenshot.png) — full frame

## Dependencies

[format-time](../../../specs/core/format-time.spec.md).

**Data SSOT:** [docs/views/timeline.md](../../../docs/views/timeline.md) (tooltip/detail).

**Input formats:** [METRICS_AND_TRACE.md](../../../docs/formats/compute/METRICS_AND_TRACE.md) (trace.json event schema — name, startTime, duration fields).

## Changelog
- **2026-11-19** — Zero-duration ticks show a bare formatted time (no `Timestamp:` label) instead of Start/Dur/End (PR-TOOLTIP-005, #205).
- **2026-09-09** — Start/end use zoom-aware `nsPerPx` digits (PR-TIME-011); duration stays 4 significant digits.
- **2026-09-07** — Single-event summary tooltips show the real event name + source `laneName` (PR-TOOLTIP-003 / 004); multi-task summaries keep "N tasks".
- **2026-09-03** — Summary events (`taskCount`) title as "N tasks" / "1 task"; PR-TOOLTIP-003.
- **2026-08-28** — Intentional: uniform digit chrome; unit via suffix text (no size/tint-by-unit).
- **2026-08-28** — Start/Dur/End display uses 4 significant digits.
- **2026-08-28** — Per-value auto units for Start/Dur/End (independent of viewport zoom); drop `timeScaleUnit` prop.
- **2026-08-10** — Recut from `v930/task-hover` (real hover tooltip dump).
- **2026-08-05** — Initial spec. Core behaviors established.
