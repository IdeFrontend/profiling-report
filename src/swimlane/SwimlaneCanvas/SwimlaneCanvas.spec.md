# SwimlaneCanvas

<!--
  spec-id-prefix: PR-CANVAS-*
  phase: MVP
  source: src/swimlane/SwimlaneCanvas/SwimlaneCanvas.vue
  test: src/swimlane/SwimlaneCanvas/SwimlaneCanvas.spec.ts
-->

Vue wrapper around CanvasSwimlaneRenderer — manages canvas lifecycle, resize, hit testing.

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| model | SwimlaneModel or null | yes | — | Swimlane data |
| view | SwimlaneViewWindow | yes | — | Current viewport window |
| selectedEventId | string or null | yes | — | Selected event ID |
| hoveredEventId | string or null | yes | — | Hovered event ID |
| searchQuery | string | yes | — | Current search text |

## Emits

| Event | Payload | Description |
|-------|---------|-------------|
| select | SwimEvent or null | Event clicked/deselected |
| hover | [event, clientX, clientY] | Event hovered with cursor pos |
| cursor | { time: number; xRatio: number } or null | Cursor time and position |
| pan | deltaTime: number | Pan gesture delta |
| zoom | [factor, anchorTime] | Zoom gesture factor and anchor |
| scroll-y | scrollY: number | Vertical scroll offset |
| set-playhead | time: number | Playhead time position |

**Behavior:** Creates renderer on mount, passes model/view, handles ResizeObserver, hit testing on click/hover, disposes on unmount.

- [Kernel block timeline](/docs/specs/ui/source/kernel-block-timeline.png)

## Acceptance Criteria

1. **PR-CANVAS-001**: Creates canvas element on mount.
1. **PR-CANVAS-002**: Canvas resizes when viewport changes.

## Edge Cases

- model is null → empty canvas.

**Dependencies:** [swimlane-renderer](/specs/core/swimlane-renderer.spec.md), [swimlane-model](/specs/core/swimlane-model.spec.md).
