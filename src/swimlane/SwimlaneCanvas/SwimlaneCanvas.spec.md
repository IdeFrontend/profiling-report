# SwimlaneCanvas

<!--
  spec-id-prefix: PR-CANVAS-*
  phase: MVP
  source: src/swimlane/SwimlaneCanvas/SwimlaneCanvas.vue
  test: src/swimlane/SwimlaneCanvas/SwimlaneCanvas.spec.ts
-->

Vue wrapper around `CanvasSwimlaneRenderer`. Translates mouse/touch events into selection, hover, pan, and zoom signals.

## Inputs

**model** carries the complete `SwimlaneModel` (processes, threads, events, time bounds) or `null` when no data is loaded. **view** carries the current `SwimlaneViewWindow` (`{ startTime, endTime, scrollY }`). **selectedEventId** and **hoveredEventId** drive highlight rendering. **searchQuery** drives event name filtering in the renderer.

## Outputs

Seven interaction events: **select** fires with a `SwimEvent` (or null) on click. **hover** fires on pointer move with the hovered event plus `clientX`/`clientY` for tooltip positioning. **cursor** fires with `{ time, xRatio }` for playhead placement. **pan** fires with a time-unit delta during drag. **zoom** fires with `[factor, anchorTime]` on Ctrl+wheel. **scroll-y** fires with the vertical scroll offset. **set-playhead** fires with a time value on click-to-seek in empty space. The parent ProfilingReport translates all of these into viewport state changes.

## Behavior

**Canvas lifecycle.** The renderer is created eagerly, the canvas element is attached on mount (initializing the 2D context), and disposed on unmount. A `ResizeObserver` triggers `renderer.resize()` when the container size changes, accounting for `devicePixelRatio`.

**Scroll model.** The container uses `overflow: hidden` with a synthetic scroll mechanism: a sizer div sets the total content height, and `localScrollY` tracks the actual scroll offset. Only the visible viewport is drawn on canvas — this enables smooth scrolling with large swimlane datasets.

**Pointer translation.** `pointermove` with >=4px movement switches to drag-pan (emits `pan` in time units). Movement <4px triggers a click — `hitTest` is called and the result emitted as `select`. Every `pointermove` performs hitTest and emits `hover` (with clientX/clientY for tooltip positioning) and `cursor` (time + xRatio for playhead).

**Reactivity.** A deep watcher on the viewport prop calls `renderer.setView()` and `renderer.render()` on every change. Model changes call `renderer.setModel()`. Selection/hover changes trigger render only (layout unchanged).

## Acceptance Criteria

1. **PR-CANVAS-001** — Creates canvas element and 2D context.
2. **PR-CANVAS-002** — Resizes on viewport change.

## Edge Cases

| State | Behavior |
|---|---|
| model is null | Empty canvas, no error |
| model has 0 processes | Empty canvas |
| view.endTime <= view.startTime | Renderer handles gracefully |
| `maxTime === minTime` | Bounds clamp adds +1 |
| Sub-pixel container size | Canvas minimum is 1×1 |
| hitTest on empty space | Returns null |

## Design sketches

- [Kernel block timeline](/docs/specs/ui/source/kernel-block-timeline.png)

## Dependencies

[swimlane-renderer](/specs/core/swimlane-renderer.spec.md), [swimlane-model](/specs/core/swimlane-model.spec.md).
