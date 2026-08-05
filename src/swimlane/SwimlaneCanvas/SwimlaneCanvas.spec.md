# SwimlaneCanvas

<!--
  spec-id-prefix: PR-CANVAS-*
  phase: MVP
  source: src/swimlane/SwimlaneCanvas/SwimlaneCanvas.vue
  test: src/swimlane/SwimlaneCanvas/SwimlaneCanvas.spec.ts
-->

Vue wrapper around `CanvasSwimlaneRenderer`. Manages canvas lifecycle, pointer-to-event translation, and viewport rendering.

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| model | SwimlaneModel or null | yes | — | Swimlane data |
| view | SwimlaneViewWindow | yes | — | Visible viewport window |
| selectedEventId | string or null | yes | — | ID of selected event (for highlight) |
| hoveredEventId | string or null | yes | — | ID of hovered event (for highlight) |
| searchQuery | string | yes | — | Current search text |

## Emits

| Event | Payload | Description |
|-------|---------|-------------|
| select | SwimEvent or null | Event clicked or deselected |
| hover | [SwimEvent or null, clientX: number, clientY: number] | Event hovered + cursor position for tooltip |
| cursor | { time: number; xRatio: number } or null | Cursor time and horizontal position |
| pan | deltaTime: number | Drag-pan delta in time units |
| zoom | [factor: number, anchorTime: number] | Ctrl+wheel zoom factor and anchor point |
| scroll-y | scrollY: number | Vertical scroll offset |
| set-playhead | time: number | Playhead time position from click on empty area |

## Behavior

**Canvas lifecycle.** `CanvasSwimlaneRenderer` is created eagerly as a class instance in `<script setup>`. On mount, the component attaches the canvas element via `renderer.attach(canvas)`, which initializes the 2D context. On unmount, `renderer.dispose()` cleans up. A `ResizeObserver` (with SSR guard) triggers `renderer.resize()` when the container size changes, accounting for `devicePixelRatio`.

**Scroll model.** The container uses `overflow: hidden` to clip the canvas. Scroll is synthetic: the component renders a sizer div with the full content height, and `localScrollY` tracks the actual scroll position. The sizer drives native scrollbar appearance while only the visible viewport is rendered on canvas.

**Pointer translation.** `pointerdown` records the starting position. `pointermove` with >=4px movement switches to drag-pan mode, emitting `pan` delta events in time units. Movement <4px is treated as a click — `hitTest` is called and the result emitted as `select`. `pointermove` always performs hitTest and emits `hover` (with clientX/clientY for tooltip positioning) and `cursor` (time + xRatio for playhead).

**Reactivity.** A `deep: true` watcher on the `view` prop calls `renderer.setView()` and `renderer.render()` on every viewport change. A separate watcher on `model` calls `renderer.setModel()` when data changes. Selection and hover changes trigger `render()` only (layout unchanged).

## Acceptance Criteria

1. **PR-CANVAS-001**: Creates canvas element on mount, attaches renderer.
1. **PR-CANVAS-002**: Canvas resizes when viewport changes via ResizeObserver.

## Edge Cases

- model is null → renderer receives null, renders empty canvas.
- Container too small (sub-pixel) → canvas minimum size is 1x1.
- `model.maxTime === model.minTime` → bounds clamp adds +1 to prevent zero division.

## Design sketches

- [Kernel block timeline](/docs/specs/ui/source/kernel-block-timeline.png)

**Dependencies:** [swimlane-renderer](/specs/core/swimlane-renderer.spec.md), [swimlane-model](/specs/core/swimlane-model.spec.md).
