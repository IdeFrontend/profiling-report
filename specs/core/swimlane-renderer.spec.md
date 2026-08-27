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

**Lane layout.** `setModel` iterates processes and threads, computes Y positions, assigns colors via `colorForThread`. Group headers at 28px, lanes at 22px. Event blocks use height `LANE_HEIGHT - 2 * LANE_PAD_Y` and are vertically centered in the lane between gutter-aligned row dividers (`(LANE_HEIGHT - h) / 2` inset, then −0.5px optical nudge). Rounded rectangles use a width-based corner radius — 1px when the on-screen block is narrower than 4px, otherwise 2px (`ctx.roundRect()` where available) — and are inset 0.5px per side so adjacent blocks keep a ≥1px gap instead of touching. Event rect edges are snapped to the device-pixel grid (and WebGL coverage AA is computed in device pixels) so borders stay crisp at fractional browser zoom / `devicePixelRatio`. Only events overlapping the current time viewport are drawn.

**Event labels.** When the on-screen (clipped) event width is wide enough (>40px), the title is drawn centered: vertically at the event block mid-line (`textBaseline: middle`), horizontally at the center of the visible intersection of the event rect with the canvas (fully on-screen → center of the event; clipped left/right → center of the remaining visible strip). Canvas fallback and the WebGL overlay share this layout.

**Search / selection emphasis.** Non-matching search hits dim to 25% opacity; when an event is selected, events that are not the selection and not its laid-out neighbors in the active `dependencyMode` and `dependencyDepth` multiply by 0.45 (combined when both apply). Dep neighbors in that filter keep full fill and label brightness; only the clicked event gets the white selection stroke. Canvas uses `globalAlpha`; WebGL rebuilds per-dim mesh layers and passes premul `uColor` RGB×dim with alpha=dim. Labels use the same dim (overlay + Canvas fallback); search non-matches omit labels. Clearing search and selection restores full opacity.

**Lane chrome.** Every event-sequence lane shares the same background fill (`#1f1f1f`); alternating zebra stripes are not used. **Card / root group headers** paint a full-width band `rgb(42, 42, 42)` (`#2a2a2a`) under the DOM Card strips in `SwimlaneView`. Horizontal dividers (`#3a3a3a`) are drawn at the bottom of each group header and each lane, aligned with the LaneGutter borders so separators read as continuous lines from the gutter across the timeline. WebGL draws the same uniform fill and 1px divider rects; Canvas uses strokes at the same edges.

**Cursor.** Vertical cursor stroke uses `#317AF7` to match axis `.pr-cursor`. Swimlane paints the follow-bar as a DOM overlay in `SwimlaneView` (under Card strips); Canvas/WebGL renderers no longer stroke the cursor.

**WebGL intervals.** Coverage-AA rounded fills use **source-over** (premultiplied) blending so nested/overlapping events match Canvas compositing — not additive Sudu-style blend, which lit up overlaps as a bright “block inside block”. Interval endpoints are uploaded relative to `model.minTime` via `encodeIntervalPair`, keeping `end > start` after float32 rounding.

**Dependency curves.** On selection, WebGL draws an instanced 2px cubic strip (one instance per link; pan/zoom via uniforms). Canvas fallback strokes the same cubic with a pred→succ linear gradient. See [DependencyLinksLayer](../../src/ui/TimelineView/SwimlaneView/DependencyLinksLayer/DependencyLinksLayer.spec.md). `SwimlaneRenderer.setDependencyMode` / `setDependencyDepth` are optional; Canvas and WebGL implement them, and `SwimlaneCanvas` calls them with `?.`.

**Hit testing.** `hitTest` computes Y relative to scroll offset, finds the matching lane by Y bounds, converts X to a time value, and finds the event whose interval contains that time. Returns the event's id string, or null if no match.

## Acceptance Criteria

1. **PR-RENDER-001**: setModel + render produces lane output on canvas without errors.
1. **PR-RENDER-002**: hitTest returns correct event id for coordinates within an event rect.
1. **PR-RENDER-003**: Handles multiple processes/threads with correct lane ordering.
1. **PR-RENDER-004**: Empty model renders empty canvas without errors.
1. **PR-RENDER-005**: dispose cleans up internal state.
1. **PR-RENDER-006**: WebGlSwimlaneRenderer attach/render/hitTest succeeds when WebGL2 is available (`skipIf` when unsupported).
1. **PR-RENDER-007**: Event label anchor centers in the full event when fully visible, and in the visible clip when partially off-screen.
1. **PR-RENDER-008**: WebGL setSearchQuery rebuilds match/dim meshes and render does not throw.
1. **PR-RENDER-009**: `encodeIntervalPair` keeps end > start after float32 rounding for large-magnitude times.
1. **PR-RENDER-010**: `eventEmphasisDim` matches Canvas factors (search 0.25 × selection 0.45); WebGL setSelection rebuilds emphasis layers and render does not throw.
1. **PR-RENDER-011**: Canvas and WebGL lane backgrounds use uniform fill `#1f1f1f` (no zebra striping).
1. **PR-RENDER-012**: Canvas and WebGL Card/group header bands use `LANE_GROUP_HEADER_FILL` (`#2a2a2a` / `rgb(42, 42, 42)`).
1. **PR-RENDER-013**: Selected event's predecessors/successors keep full fill and label brightness.
1. **PR-RENDER-014**: `SwimlaneRenderer.setDependencyMode` / `setDependencyDepth` are optional (existing implementers stay valid).
1. **PR-RENDER-015**: `eventRadius` returns 1px below 4px width and 2px otherwise.

## Edge Cases

- hitTest on empty space → null. Very narrow viewport → sub-pixel events draw anyway.

## Dependencies

[swimlane-model](./swimlane-model.spec.md), [view-state](./view-state.spec.md).

## Open

WebGL hybrid path is implemented (`WebGlSwimlaneRenderer` + Canvas overlay); Canvas remains the fallback when WebGL2 is unavailable.

## Changelog
- **2026-08-27** — Snap event rect edges to the device-pixel grid; WebGL coverage AA in device pixels (crisp borders at fractional browser zoom).
- **2026-08-19** — Dependency curve stroke 2px.
- **2026-08-19** — WebGL attach/curve paint in Chromium is PR-E2E-007; jsdom unit tests `skipIf` when `webgl2` is missing.
- **2026-08-18** — Canvas fallback reuses the fill-pass visible list for strokes/labels (no second full-event cull).
- **2026-08-18** — `setDependencyMode` / `setDependencyDepth` optional on `SwimlaneRenderer`; PR-RENDER-014.
- **2026-08-17** — `dependencyDepth` hops (default 1, −1 no hop cap; 10 000 links per side).
- **2026-08-14** — `dependencyMode` filters which neighbors stay bright.
- **2026-08-14** — WebGL instanced dependency polylines; Canvas 2D fallback.
- **2026-08-13** — Dep neighbors undimmed with selection (fill + labels).
- **2026-08-13** — Swim cursor is DOM in SwimlaneView (not Canvas/WebGL stroke); Card header band `#2a2a2a`; PR-RENDER-012.
- **2026-08-11** — Lane fill `#1f1f1f` (sketch-sampled `--pr-bg-deep`).
- **2026-08-10** — WebGL selection + search emphasis parity with Canvas (fills + labels); premul alpha dim.
- **2026-08-10** — WebGL source-over blend + float32-safe interval encoding (no bright nested overdraw).
- **2026-08-10** — WebGL search dimming (match Canvas 0.25); overlay cursor `#317AF7`.
- **2026-08-07** — Event blocks vertically centered in lane rows; labels centered in the visible event rect (Canvas + WebGL overlay).
- **2026-08-07** — Uniform lane backgrounds; horizontal dividers aligned with gutter borders (Canvas + WebGL).
- **2026-08-05** — Initial spec. Core behaviors established.
