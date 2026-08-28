# Swimlane Renderer

| spec-id-prefix |
|----------------|
| PR-RENDER-*    |

Imperative Canvas 2D / WebGL renderer drawing swimlane lanes, event blocks, group headers, and overlays.

```ts
class CanvasSwimlaneRenderer {
  attach(canvas: HTMLCanvasElement): void;
  /** Backing store = device pixels; `dpr` is window.devicePixelRatio for CSS↔device bridge only. */
  resize(devicePixelWidth: number, devicePixelHeight: number, dpr: number): void;
  setModel(model: SwimlaneModel): void;
  setView(view: SwimlaneViewWindow): void;
  render(): void;
  /** `x` / `y` are device pixels (host multiplies CSS pointer by `dpr`). */
  hitTest(x: number, y: number): string | null;
  dispose(): void;
}
```

## Behavior

**Lifecycle.** Created as a plain class instance. `attach` binds the canvas and acquires a 2D context (or WebGL2). `dispose` nulls internal refs — subsequent calls are no-ops.

**Canvas backing-store sizing (device pixels).** The owning `SwimlaneCanvas` observes its **main** canvas with `ResizeObserver` (`{ box: 'device-pixel-content-box' }`). Until that observer delivers a positive device-pixel box (`lastDeviceW` / `lastDeviceH` both ≥ 1), canvas backing stores stay **0×0** and the renderer does not paint (no HTML default 300×150, no speculative `css × devicePixelRatio` size). On each callback, for the entry whose `target` is that main canvas, it reads `devicePixelContentBoxSize` — `inlineSize` (width) and `blockSize` (height). Those values are the only authority for the framebuffer size. `SwimlaneCanvas` calls `resize(deviceW, deviceH, window.devicePixelRatio)` on each active renderer (WebGL fills, Canvas overlay, or Canvas fallback). Each `resize` sets that canvas element's backing-store **`width`** / **`height`** attributes to those device-pixel values. The size is **never** derived by multiplying a CSS size by `window.devicePixelRatio` for the buffer outside an RO callback, and **never** applied via `canvas.style.width` / `style.height` (shared `.pr-swim-canvas` rules use constant `width`/`height: 100%` of the wrap). If an RO entry lacks `devicePixelContentBoxSize`, `contentBoxSize × dpr` from that same entry may be used. `dpr` is stored only to scale CSS layout constants into device pixels for paint and hit-testing. Device-pixel `width` / `height` drive `gl.viewport`, shader `uResolution`, Canvas 2D drawing in identity CTM, hit-test, and labels — one size shared across the stack via identical `resize` arguments.

**Paint / shader space (integer device pixels).** Lane metrics (`LANE_HEIGHT`, etc.) remain defined in CSS. The renderer scales them by `dpr` into device pixels, then paints entirely in that space. Canvas 2D uses an **identity** CTM (no `setTransform(dpr, …)`). WebGL maps clip space with `uResolution = (deviceW, deviceH)` and **does not** use a `uDpr` uniform — snap and gap are integer / device-pixel only: edges `floor(x + 0.5)`; abutting fills keep a **1 device-pixel** gap. **Interim:** WebGL event fills are **hard axis-aligned rects** (no round-rect / SDF); Canvas 2D still uses `eventRadius` (**1** device px when width `< 4`, else **2**). Optical −0.5 CSS nudge becomes `round((-0.5) * dpr)` after scale.

**Lane layout.** `setModel` iterates processes and threads, computes Y positions (CSS), assigns colors via `colorForThread`. Group headers at 28 CSS px, lanes at 22 CSS px. Event blocks use height `LANE_HEIGHT - 2 * LANE_PAD_Y`, vertically centered, then scaled to device px for paint. Only events overlapping the current time viewport are drawn.

**Event labels.** When the on-screen (clipped) event width is wide enough (>40 CSS px before scale, or equivalent device width), the title is drawn centered in the visible event rect. Canvas fallback and the WebGL overlay share this layout (device-pixel glyph placement).

**Search / selection emphasis.** Non-matching search hits dim to 25% opacity; when an event is selected, events that are not the selection and not its laid-out neighbors in the active `dependencyMode` and `dependencyDepth` multiply by 0.45 (combined when both apply). Dep neighbors in that filter keep full fill and label brightness; only the clicked event gets the white selection stroke (**2 CSS px** → `round(2 × dpr)` device px); hover uses **1.5 CSS px** (`round(1.5 × dpr)`). Canvas uses `globalAlpha`; WebGL rebuilds per-dim mesh layers and passes premul `uColor` RGB×dim with alpha=dim. Labels use the same dim (overlay + Canvas fallback); search non-matches omit labels. Clearing search and selection restores full opacity.

**Lane chrome.** Every event-sequence lane shares the same background fill (`#1f1f1f`); alternating zebra stripes are not used. **Card / root group headers** paint a full-width band `rgb(42, 42, 42)` (`#2a2a2a`) under the DOM Card strips in `SwimlaneView`. Horizontal dividers (`#3a3a3a`) are drawn at the bottom of each group header and each lane (1 device px), aligned with the LaneGutter borders. WebGL draws the same uniform fill and divider rects; Canvas uses strokes at the same edges.

**Cursor.** Vertical cursor stroke uses `#317AF7` to match axis `.pr-cursor`. Swimlane paints the follow-bar as a DOM overlay in `SwimlaneView` (under Card strips); Canvas/WebGL renderers no longer stroke the cursor.

**WebGL intervals.** Hard-rect fills use **source-over** (premultiplied) blending so nested/overlapping events match Canvas compositing — not additive Sudu-style blend. Interval endpoints are uploaded relative to `model.minTime` via `encodeIntervalPair`, keeping `end > start` after float32 rounding.

**Dependency curves.** On selection, WebGL draws an instanced cubic strip **2 device pixels** wide (one instance per link; pan/zoom via uniforms). Canvas fallback strokes the same cubic with a pred→succ linear gradient. See [DependencyLinksLayer](../../src/ui/TimelineView/SwimlaneView/DependencyLinksLayer/DependencyLinksLayer.spec.md). `SwimlaneRenderer.setDependencyMode` / `setDependencyDepth` are optional; Canvas and WebGL implement them, and `SwimlaneCanvas` calls them with `?.`.

**Hit testing.** `hitTest(x, y)` expects **device-pixel** coordinates (host: CSS pointer × `dpr`). It scales CSS lane/`scrollY` layout by `dpr` (or equivalently divides `y` by `dpr`), finds the matching lane, converts X to time using device-pixel track width, and returns the event id or null. `eventScreenRect` returns device-pixel bounds.

## Acceptance Criteria

1. **PR-RENDER-001**: setModel + render produces lane output on canvas without errors.
1. **PR-RENDER-002**: hitTest returns correct event id for **device-pixel** coordinates within an event rect.
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
1. **PR-RENDER-017**: `eventRadius` returns 1 device px below 4 device-px width and 2 device px otherwise (Canvas paint; WebGL fills are square until round-rect is restored).
1. **PR-RENDER-018**: `snapEventRect` (device-px inputs) aligns all four edges to integer device pixels; min size 1 device px.
1. **PR-RENDER-019**: `resize(deviceW, deviceH, dpr)` sets `canvas.width/height` to device args without writing `canvas.style`; WebGL has no `uDpr` uniform.

## Edge Cases

- hitTest on empty space → null. Very narrow viewport → sub-pixel events still draw after snap to ≥1 device px.
- Backing-store size comes only from the host’s RO `devicePixelContentBoxSize` (passed into `resize`); it is never recomputed inside the renderer as `window.devicePixelRatio` × CSS size.

## Dependencies

[swimlane-model](./swimlane-model.spec.md), [view-state](./view-state.spec.md).

## Open

WebGL hybrid path is implemented (`WebGlSwimlaneRenderer` + Canvas overlay); Canvas remains the fallback when WebGL2 is unavailable.

## Changelog
- **2026-08-28** — WebGL: temporary hard-rect event fills (SDF round-rect removed) ahead of sudu coverage restore.
- **2026-08-28** — `resize(devicePixelWidth, devicePixelHeight, dpr)`; paint/hit-test/shaders in integer device pixels; no `uDpr` / no `setTransform(dpr)`; CSS layout scaled by `dpr` at the paint boundary; 1 device-px gap; host RO drives buffer size.
- **2026-08-28** — Canvas backing-store sizing contract: device-pixel size from `ResizeObserver` `devicePixelContentBoxSize`; no `style` sizing.
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
