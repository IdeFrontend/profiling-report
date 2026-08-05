# SwimlaneCanvas

<!--
  spec-id-prefix: PR-CANVAS-*
  phase: MVP
  source: src/swimlane/SwimlaneCanvas/SwimlaneCanvas.vue
  test: src/swimlane/SwimlaneCanvas/SwimlaneCanvas.spec.ts
-->

Vue wrapper around `CanvasSwimlaneRenderer`. Translates mouse/touch events into selection, hover, pan, and zoom signals.

## Behavior

**Canvas lifecycle.** The renderer is created eagerly, the canvas element is attached on mount (initializing the 2D context), and disposed on unmount. A `ResizeObserver` triggers `renderer.resize()` when the container size changes, accounting for `devicePixelRatio`.

**Scroll model.** The container uses `overflow: hidden` with a synthetic scroll mechanism: a sizer div sets the total content height, and `localScrollY` tracks the actual scroll offset. Only the visible viewport is drawn on canvas — this enables smooth scrolling with large swimlane datasets.

**Pointer translation.** `pointermove` with >=4px movement switches to drag-pan (emits `pan` in time units). Movement <4px triggers a click — `hitTest` is called and the result emitted as `select`. Every `pointermove` performs hitTest and emits `hover` (with clientX/clientY for tooltip positioning) and `cursor` (time + xRatio for playhead).

**Reactivity.** A deep watcher on the viewport prop calls `renderer.setView()` and `renderer.render()` on every change. Model changes call `renderer.setModel()`. Selection/hover changes trigger render only (layout unchanged).

## Acceptance Criteria

1. **PR-CANVAS-001** — Creates canvas element and 2D context.
2. **PR-CANVAS-002** — Resizes on viewport change.

## Edge Cases

- model is null → canvas renders empty.
- `maxTime === minTime` → bounds clamp adds +1 to prevent division by zero.
- Sub-pixel container size → canvas minimum is 1×1.

## Design sketches

- [Kernel block timeline](/docs/specs/ui/source/kernel-block-timeline.png)

## Dependencies

[swimlane-renderer](/specs/core/swimlane-renderer.spec.md), [swimlane-model](/specs/core/swimlane-model.spec.md).
