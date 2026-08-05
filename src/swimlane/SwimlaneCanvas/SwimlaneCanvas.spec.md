# SwimlaneCanvas

<!--
  metadata
  spec-id-prefix: PR-CANVAS-*
  phase: MVP
  owner: -
  last-updated: 2026-08-04
  source: src/swimlane/SwimlaneCanvas/SwimlaneCanvas.vue
  test: src/swimlane/SwimlaneCanvas/SwimlaneCanvas.spec.ts
-->

## Purpose

Vue wrapper around CanvasSwimlaneRenderer — manages canvas lifecycle, resize, and hit testing.

## Inputs / Outputs

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| model | SwimlaneModel or null | yes | — | Swimlane data |
| view | SwimlaneViewWindow | yes | — | Current viewport window |
| selectedEventId | string or null | yes | — | ID of selected event |
| hoveredEventId | string or null | yes | — | ID of hovered event |
| searchQuery | string | yes | — | Current search text |

### Emits

| Event | Payload | Description |
|-------|---------|-------------|
| select | SwimEvent or null | Event clicked or deselected |
| hover | [event: SwimEvent or null, clientX: number, clientY: number] | Event hovered with cursor position |
| cursor | { time: number; xRatio: number } or null | Cursor time and position |
| pan | deltaTime: number | Pan gesture delta in time units |
| zoom | [factor: number, anchorTime: number] | Zoom gesture factor and anchor |
| scroll-y | scrollY: number | Vertical scroll offset |
| set-playhead | time: number | Playhead time position |

## Behavior

- Creates CanvasSwimlaneRenderer on mount.
- Passes model and view to renderer.
- Handles resize via ResizeObserver.
- Performs hit testing on click and hover.
- Cleans up renderer on unmount.

## Design sketches

- [Kernel block timeline](/docs/specs/ui/source/kernel-block-timeline.png) — swimlane lanes with colored event blocks, time axis, and playhead

## Acceptance Criteria

1. **PR-CANVAS-001**: Creates canvas element on mount.
1. **PR-CANVAS-002**: Calls renderer.setModel when model prop changes.

## Edge Cases

- model is null — renders empty canvas.
- Very small container — canvas resizes to minimum.

## Dependencies

- [specs/core/swimlane-renderer.spec.md] — CanvasSwimlaneRenderer.
- [specs/core/swimlane-model.spec.md] — SwimlaneModel.

## Open Questions

- None.
