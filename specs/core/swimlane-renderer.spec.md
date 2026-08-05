# Swimlane Renderer

<!--
  spec-id-prefix: PR-RENDER-*
  phase: MVP
  source: src/swimlane/CanvasSwimlaneRenderer.ts
  test: tests/unit/canvasRenderer.spec.ts
-->

Imperative Canvas 2D renderer drawing swimlane lanes, event blocks, group headers, and a time axis.

```ts
class CanvasSwimlaneRenderer {
  attach(canvas: HTMLCanvasElement): void;         // bind canvas, init 2D context
  resize(width: number, height: number): void;      // resize, account for devicePixelRatio
  setModel(model: SwimlaneModel): void;             // store data, rebuild lane layout
  setView(view: SwimlaneViewWindow): void;          // update visible viewport
  render(): void;                                    // draw everything
  hitTest(x: number, y: number): string | null;     // event id at coordinates, or null
  dispose(): void;                                   // release canvas refs
}
```

## Behavior

**Lifecycle.** Created as a plain class instance. `attach` binds the canvas and acquires a 2D context. `dispose` nulls internal refs — subsequent calls are no-ops.

**HiDPI rendering.** `resize` multiplies canvas backing store by `window.devicePixelRatio` to ensure crisp rendering on Retina displays. Logical dimensions stored separately for layout calculations.

**Lane layout.** `setModel` iterates processes and threads, computes Y positions, assigns colors via `colorForThread`. Group headers at 28px, lanes at 22px with 3px padding. Event rendering uses rounded rectangles (corner radius 5px, falls back to `ctx.roundRect()` where available). Only events visible in the current viewport are drawn.

**Hit testing.** `hitTest` computes Y relative to scroll offset, finds the matching lane by Y bounds, converts X to a time value, and finds the event whose interval contains that time. Returns the event's id string, or null if no match.

## Acceptance Criteria

1. **PR-RENDER-001**: setModel + render produces lane output on canvas without errors.
1. **PR-RENDER-002**: hitTest returns correct event id for coordinates within an event rect.
1. **PR-RENDER-003**: Handles multiple processes/threads with correct lane ordering.
1. **PR-RENDER-004**: Empty model renders empty canvas without errors.
1. **PR-RENDER-005**: dispose cleans up internal state.

## Edge Cases

- hitTest on empty space → null. Very narrow viewport → sub-pixel events draw anyway.

## Dependencies

[swimlane-model](./swimlane-model.spec.md), [view-state](./view-state.spec.md).

## Open

Phase 2 WebGL hybrid renderer for better coverage AA at scale.

## Changelog
- **2026-08-05** — Initial spec. Core behaviors established.
