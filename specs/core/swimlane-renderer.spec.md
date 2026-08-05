# Swimlane Renderer

<!--
  spec-id-prefix: PR-RENDER-*
  phase: MVP
  source: src/swimlane/CanvasSwimlaneRenderer.ts
  test: tests/unit/canvasRenderer.spec.ts
-->

Imperative Canvas 2D renderer drawing swimlane lanes, event blocks, group headers, and a time axis onto an HTML canvas element.

```ts
class CanvasSwimlaneRenderer {
  attach(canvas: HTMLCanvasElement): void;
  resize(width: number, height: number): void;
  setModel(model: SwimlaneModel): void;
  setView(view: SwimlaneViewWindow): void;
  render(): void;
  hitTest(x: number, y: number): string | null;
  dispose(): void;
}
```

## Behavior

**Lifecycle.** Created as a plain class instance. `attach(canvas)` binds the canvas element, acquires a 2D rendering context, and calls `resize()` with the initial dimensions. `dispose()` nulls out internal references so subsequent calls are no-ops — the canvas and context are released for garbage collection.

**Resize and DPR.** On `resize(w, h)`, the canvas backing store dimensions are multiplied by `window.devicePixelRatio` (with SSR guard). This ensures crisp rendering on HiDPI/Retina displays. The logical width/height are stored separately for layout calculations; the canvas CSS size is managed externally by SwimlaneCanvas.

**Layout.** `setModel` rebuilds the internal lane layout: iterates processes and threads, computes Y positions for each lane, assigns colors via `colorForThread`, lays out group headers at `LANE_GROUP_HEADER_HEIGHT = 28px`. Each lane is `LANE_HEIGHT = 22px` with `LANE_PAD_Y = 3px` padding.

**Rendering.** `render()` clears the canvas, applies a vertical offset from `view.scrollY`, draws group headers (filled rectangles with process names), draws lane backgrounds, then draws event blocks as filled rounded rectangles. Only events visible in the current viewport window are drawn. Time axis ticks are drawn at the top with adaptive spacing.

**Event rendering.** Each event block is a rounded rectangle with `EVENT_RADIUS = 5px` (or falls back to `ctx.roundRect()` if available). The fill color is the thread's assigned color. Events narrower than 1px are still drawn — the caller handles sub-pixel zoom states. The time axis renders labeled ticks in the current unit with adaptive step sizing.

**Hit testing.** `hitTest(x, y)` computes the Y position relative to scroll offset, finds the matching lane by Y bounds, then converts the X coordinate to a time value and finds the event whose interval contains that time. Returns the event's `id` string, or `null` if no match.

## Acceptance Criteria

1. **PR-RENDER-001**: setModel + render produces lane output on canvas without errors.
1. **PR-RENDER-002**: hitTest returns correct event id for coordinates within an event rect.
1. **PR-RENDER-003**: Handles multiple processes/threads with correct lane ordering.
1. **PR-RENDER-004**: Empty model renders empty canvas without errors.
1. **PR-RENDER-005**: dispose cleans up internal state so subsequent calls are no-ops.

## Edge Cases

- hitTest on empty space → null.
- Very narrow viewport → events may be sub-pixel; render gracefully (draw anyway).
- DPR=1 displays → no HiDPI scaling applied.

**Dependencies:** [swimlane-model](./swimlane-model.spec.md), [view-state](./view-state.spec.md).

**Open:** Phase 2 WebGL hybrid renderer for better coverage AA at scale.
