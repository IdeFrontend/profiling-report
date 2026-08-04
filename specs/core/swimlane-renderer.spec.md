# Swimlane Renderer

<!--
  metadata
  spec-id-prefix: PR-RENDER-*
  phase: MVP
  owner: -
  last-updated: 2026-08-04
  source: src/swimlane/CanvasSwimlaneRenderer.ts
  test: tests/unit/canvasRenderer.spec.ts
-->

## Purpose

Render swimlane lanes, events, lane headers, and the time axis on an HTML Canvas 2D surface.

## Inputs / Outputs

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
| attach(canvas) | Binds the canvas element and initializes rendering context |
| resize(w, h) | Resizes the canvas accounting for device pixel ratio |
| setModel(model) | Stores the swimlane data and rebuilds layout |
| setView(view) | Updates the visible viewport window |
| render() | Draws lanes, events, headers, and time axis to canvas |
| hitTest(x, y) | Returns the event id string at given canvas coordinates, or null |
| dispose() | Cleans up canvas resources |

## Behavior

- setModel stores the data and rebuilds internal lane layout.
- setView updates the viewport window; render redraws with new bounds.
- hitTest returns a string event id (not a SwimEvent object).
- attach is called once on mount to bind the canvas element.
- dispose is called on unmount to clean up.

## Acceptance Criteria

1. **PR-RENDER-001**: setModel followed by render produces lane output on canvas without errors.
1. **PR-RENDER-002**: hitTest returns correct event id for coordinates within an event rect.
1. **PR-RENDER-003**: render handles multiple processes and threads with correct lane ordering.
1. **PR-RENDER-004**: setModel with empty model renders empty canvas without errors.
1. **PR-RENDER-005**: dispose cleans up internal state so subsequent calls are no-ops.

## Edge Cases

- Empty model — render produces empty canvas (no lanes).
- Very narrow viewport — events may be sub-pixel; render gracefully.
- hitTest on empty space — returns null.

## Dependencies

- [specs/core/swimlane-model.spec.md] — SwimlaneModel input.
- [specs/core/view-state.spec.md] — SwimlaneViewWindow input.

## Open Questions

- Phase 2 WebGL hybrid renderer (see research/SWIMLANE_IMPLEMENTATIONS.md).
