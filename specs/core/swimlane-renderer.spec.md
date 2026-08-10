# Swimlane Renderer

| spec-id-prefix |
|----------------|
| PR-RENDER-*    |

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

**Lane layout.** `setModel` iterates processes and threads, computes Y positions, assigns colors via `colorForThread`. Group headers at 28px, lanes at 22px. Event blocks use height `LANE_HEIGHT - 2 * LANE_PAD_Y` and are vertically centered in the lane between gutter-aligned row dividers (`(LANE_HEIGHT - h) / 2` inset, then −0.5px optical nudge). Rounded rectangles use corner radius 5px (`ctx.roundRect()` where available). Only events overlapping the current time viewport are drawn.

**Event labels.** When the on-screen (clipped) event width is wide enough (>40px), the title is drawn centered: vertically at the event block mid-line (`textBaseline: middle`), horizontally at the center of the visible intersection of the event rect with the canvas (fully on-screen → center of the event; clipped left/right → center of the remaining visible strip). Canvas fallback and the WebGL overlay share this layout.

**Lane chrome.** Every event-sequence lane shares the same background fill (`#2a2a2a`); alternating zebra stripes are not used. Horizontal dividers (`#3a3a3a`) are drawn at the bottom of each group header and each lane, aligned with the LaneGutter borders so separators read as continuous lines from the gutter across the timeline. WebGL draws the same uniform fill and 1px divider rects; Canvas uses strokes at the same edges.

**Hit testing.** `hitTest` computes Y relative to scroll offset, finds the matching lane by Y bounds, converts X to a time value, and finds the event whose interval contains that time. Returns the event's id string, or null if no match.

## Acceptance Criteria

1. **PR-RENDER-001**: setModel + render produces lane output on canvas without errors.
1. **PR-RENDER-002**: hitTest returns correct event id for coordinates within an event rect.
1. **PR-RENDER-003**: Handles multiple processes/threads with correct lane ordering.
1. **PR-RENDER-004**: Empty model renders empty canvas without errors.
1. **PR-RENDER-005**: dispose cleans up internal state.
1. **PR-RENDER-006**: WebGlSwimlaneRenderer attach/render/hitTest succeeds when WebGL2 is available (skipped when unsupported).
1. **PR-RENDER-007**: Event label anchor centers in the full event when fully visible, and in the visible clip when partially off-screen.

## Edge Cases

- hitTest on empty space → null. Very narrow viewport → sub-pixel events draw anyway.

## Dependencies

[swimlane-model](./swimlane-model.spec.md), [view-state](./view-state.spec.md).

## Open

WebGL hybrid path is implemented (`WebGlSwimlaneRenderer` + Canvas overlay); Canvas remains the fallback when WebGL2 is unavailable.

## Changelog
- **2026-08-07** — Event blocks vertically centered in lane rows; labels centered in the visible event rect (Canvas + WebGL overlay).
- **2026-08-07** — Uniform lane backgrounds; horizontal dividers aligned with gutter borders (Canvas + WebGL).
- **2026-08-05** — Initial spec. Core behaviors established.
