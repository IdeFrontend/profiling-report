# TimeOverviewBar

<!--
  spec-id-prefix: PR-OVERVIEW-*
  phase: MVP
  source: src/ui/TimeOverviewBar/TimeOverviewBar.vue
  test: src/ui/TimeOverviewBar/TimeOverviewBar.spec.ts
-->

Full timeline preview bar with a draggable/resizable window indicator representing the visible viewport. Allows rapid navigation to any region of a long trace without zooming and panning through the main canvas.

## Inputs

The component receives the full timeline bounds (**minTime**, **maxTime**) and the current visible window (**startTime**, **endTime**) in the parent's internal time units (nanoseconds). **timeUnit** controls label formatting.

## Outputs

A single event: **update:window** carries `{ startTime, endTime }` when the user finishes dragging or resizing the window indicator. The parent ProfilingReport applies this via `applyWindow`, updating the viewport for all children.

## Behavior

**Proportional mapping.** Window position and size are computed as percentages of the total span: `left = (startTime - minTime) / span`, `width = (endTime - startTime) / span`. When the window covers the full timeline, the indicator fills the entire bar.

**Drag modes.** The window indicator supports three operations: move the entire window, resize from the left handle, resize from the right handle. Handles have an expanded hit target area for usability. Pointer events initiate a drag mode; pointer move adjusts window boundaries proportionally; on pointer up, the component emits `update:window` with the new time range.

**Parent integration.** The parent ProfilingReport receives the `update:window` event and applies the new window to `SwimlaneViewState` via `applyWindow`. All children re-render with the updated viewport.

## Acceptance Criteria

1. **PR-OVERVIEW-001** — Renders timeline bar.
2. **PR-OVERVIEW-002** — Indicator covers correct proportion of the timeline.

## Edge Cases

| State | Behavior |
|---|---|
| minTime equals maxTime | No bar rendered (single point) |
| Window covers full timeline | Indicator fills entire bar, handles at edges |
| Very short window (<1% of span) | Handles merge visually but are independently draggable |
| startTime < minTime or endTime > maxTime | Window clamped to bounds |

## Design sketches

- [Statistical analysis (overview charts)](../../../docs/specs/ui/source/statistical-analysis.png)

## Changelog
- **2026-08-05** — Initial spec. Core behaviors established.
