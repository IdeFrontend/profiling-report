# TimeOverviewBar

<!--
  spec-id-prefix: PR-OVERVIEW-*
  phase: MVP
  source: src/ui/TimeOverviewBar/TimeOverviewBar.vue
  test: src/ui/TimeOverviewBar/TimeOverviewBar.spec.ts
-->

Full timeline preview bar with a draggable/resizable window indicator representing the visible viewport. Allows rapid navigation to any region of a long trace without zooming and panning through the main canvas.

## Behavior

**Proportional mapping.** Window position and size are computed as percentages of the total span: `left = (startTime - minTime) / span`, `width = (endTime - startTime) / span`. When the window covers the full timeline, the indicator fills the entire bar.

**Drag modes.** The window indicator supports three operations: move the entire window, resize from the left handle, resize from the right handle. Handles have an expanded hit target area for usability. Pointer events initiate a drag mode; pointer move adjusts window boundaries proportionally; on pointer up, the component emits `update:window` with the new time range.

**Parent integration.** The parent ProfilingReport receives the `update:window` event and applies the new window to `SwimlaneViewState` via `applyWindow`. All children re-render with the updated viewport.

## Acceptance Criteria

1. **PR-OVERVIEW-001** — Renders timeline bar.
2. **PR-OVERVIEW-002** — Indicator covers correct proportion of the timeline.

## Edge Cases

- minTime equals maxTime → no bar rendered (single point, nothing to navigate).
- Window covers full timeline → indicator fills entire bar, handles at edges.
- Very short window (<1% of span) → handles merge visually but are independently draggable.

## Design sketches

- [Statistical analysis (overview charts)](/docs/specs/ui/source/statistical-analysis.png)
