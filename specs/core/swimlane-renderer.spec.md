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
  setModel(model: SwimlaneModel): void;
  setView(view: SwimlaneViewState): void;
  render(): void;
  hitTest(x: number, y: number): SwimEvent | null;
  dispose(): void;
}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| model | SwimlaneModel | Process/thread/event structure |
| view | SwimlaneViewState | Current viewport state |

## Behavior

- setModel stores the data to render.
- setView updates the visible viewport.
- render draws lanes, events, headers, and axis to the canvas.
- hitTest returns the SwimEvent at given canvas coordinates (null if none).
- dispose cleans up canvas resources.

## Acceptance Criteria

1. **PR-RENDER-001**: setModel followed by render produces lane output on canvas without errors.
1. **PR-RENDER-002**: hitTest returns correct event for coordinates within an event rect.

## Edge Cases

- Empty model — render produces empty canvas (no lanes).
- Very narrow viewport — events may be sub-pixel; render gracefully.
- hitTest on empty space — returns null.

## Dependencies

- [specs/core/swimlane-model.spec.md] — SwimlaneModel input.
- [specs/core/view-state.spec.md] — SwimlaneViewState input.

## Open Questions

- Phase 2 WebGL hybrid renderer (see research/SWIMLANE_IMPLEMENTATIONS.md).
