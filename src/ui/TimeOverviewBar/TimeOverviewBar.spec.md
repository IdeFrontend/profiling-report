# TimeOverviewBar

<!--
  spec-id-prefix: PR-OVERVIEW-*
  phase: MVP
  source: src/ui/TimeOverviewBar/TimeOverviewBar.vue
  test: src/ui/TimeOverviewBar/TimeOverviewBar.spec.ts
-->

Full timeline preview bar with a draggable/resizable window indicator representing the visible viewport. Allows rapid navigation to any region of a long trace.

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| minTime | number | yes | — | Timeline start time |
| maxTime | number | yes | — | Timeline end time |
| startTime | number | yes | — | Visible viewport start |
| endTime | number | yes | — | Visible viewport end |
| timeUnit | TimeDisplayUnit | yes | — | Time unit for labels |

## Emits

| Event | Payload | Description |
|-------|---------|-------------|
| update:window | { startTime: number; endTime: number } | Viewport window changed by drag or resize |

## Behavior

**Rendering.** The component renders a horizontal bar representing the full timeline span, with a colored window indicator showing the current visible region. The window indicator has three drag modes: move the entire window, resize from the left handle, resize from the right handle. Handles have an expanded hit target area for usability.

**Proportional mapping.** Window position and size are computed as percentages of the total span. `left = (startTime - minTime) / span`, `width = (endTime - startTime) / span`. When the window covers the full timeline, the indicator fills the entire bar.

**Drag handling.** Pointer events on the window or handles initiate drag mode (`'move'`, `'left'`, `'right'`). Pointer move adjusts the window boundaries proportionally. On `pointerup`, the component emits `update:window` with the new time range. The parent ProfilingReport applies the change to `SwimlaneViewState` and all children re-render.

## Acceptance Criteria

1. **PR-OVERVIEW-001**: Renders timeline bar with window indicator showing correct proportion.
1. **PR-OVERVIEW-002**: Window indicator covers correct proportion of total span.

## Edge Cases

- minTime equals maxTime → no bar rendered (single point, no timeline to navigate).
- Window covers full timeline → indicator fills entire bar, handles at edges.
- Very short window (<1% of span) → handles merge visually but remain independently draggable.

## Design sketches

- [Statistical analysis (overview charts)](/docs/specs/ui/source/statistical-analysis.png)
