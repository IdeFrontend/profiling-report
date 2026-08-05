# Swimlane Renderer

<!--
  spec-id-prefix: PR-RENDER-*
  phase: MVP
  source: src/swimlane/CanvasSwimlaneRenderer.ts
  test: tests/unit/canvasRenderer.spec.ts
-->

Imperative Canvas 2D renderer for swimlane lanes, events, headers, and time axis.

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

| Method | Description |
|--------|-------------|
| attach(canvas) | Bind canvas element, init rendering context |
| resize(w, h) | Resize canvas accounting for device pixel ratio |
| setModel(model) | Store swimlane data, rebuild lane layout |
| setView(view) | Update viewport window |
| render() | Draw lanes, events, headers, time axis |
| hitTest(x, y) | Return event id string at coordinates, or null |
| dispose() | Clean up canvas resources |

## Acceptance Criteria

1. **PR-RENDER-001**: setModel + render produces lane output on canvas without errors.
1. **PR-RENDER-002**: hitTest returns correct event id for coordinates within an event rect.
1. **PR-RENDER-003**: Handles multiple processes/threads with correct lane ordering.
1. **PR-RENDER-004**: Empty model renders empty canvas without errors.
1. **PR-RENDER-005**: dispose cleans up internal state.

## Edge Cases

- hitTest on empty space → null.
- Very narrow viewport → events may be sub-pixel; render gracefully.

**Dependencies:** [swimlane-model](./swimlane-model.spec.md), [view-state](./view-state.spec.md).

**Open:** Phase 2 WebGL hybrid renderer.
