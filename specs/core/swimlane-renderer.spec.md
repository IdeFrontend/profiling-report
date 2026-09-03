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

**Paint / shader space (integer device pixels).** Lane metrics (`LANE_HEIGHT`, etc.) remain defined in CSS. The renderer scales them by `dpr` into device pixels, then paints entirely in that space. Canvas 2D uses an **identity** CTM (no `setTransform(dpr, …)`). WebGL maps clip space with `uResolution = (deviceW, deviceH)` and **does not** use a `uDpr` uniform. The interval vertex shader passes **exact** device-pixel event edges in `vLrScreen` (`glToPixelX(translateScaleX(lX/rX))` — no gap inset, no snap) and expands each vertex’s own `screenX` with `mix(floor(screenX), ceil(screenX), aTex.y)`. The fragment shader combines sudu analytical horizontal coverage (`hCoverage` = event∩current device pixel width) with an SDF round-rect shape (`uYBounds` for top/bottom) via **`min(hCoverage, rrShape)`** — not a product — so thin/sub-pixel columns keep analytical brightness and wide edges are not double-dimmed. Corner radius follows a **CSS-pixel** policy (single source `minRR`/`maxRR`/`rrSwitchThreshold` in `shaders.ts`): an event gets `minRR` (1 CSS px) when its raw width (CSS px) `< rrSwitchThreshold` (4), else `maxRR` (2 CSS px). Host TS scales that by `dpr` — WebGL uploads the three as one `vec3` `uRR` uniform (no per-scene scale, no CSS px in the shader): the painted radii `xy` round to integer device px (`((x+0.5)|0)`), while the switch threshold `z` stays the exact `rrSwitchThreshold × dpr` so the cutoff tracks the true CSS boundary; Canvas passes the same device-px radius to `roundRectPath`. Canvas 2D may still inset for gaps. Optical −0.5 CSS nudge becomes `round((-0.5) * dpr)` after scale.

**Lane layout.** `setModel` iterates processes and threads, computes Y positions (CSS), assigns colors via `colorForThread`. Group headers at 28 CSS px, lanes at 22 CSS px. Event blocks use height `LANE_HEIGHT - 2 * LANE_PAD_Y`, vertically centered, then scaled to device px for paint. Only events overlapping the current time viewport are drawn.

**Event labels.** When the on-screen (clipped) event width is wide enough (>40 CSS px before scale, or equivalent device width), the title is drawn centered in the visible event rect. Canvas fallback and the WebGL overlay share this layout (device-pixel glyph placement).

**Search / selection emphasis.** Non-matching search hits dim to 25% opacity; when an event is selected, events that are not the selection and not its laid-out neighbors in the active `dependencyMode` and `dependencyDepth` render as a solid dark-gray block `#2C2C2C` (`SELECTION_MUTED_FILL`) with label text `#969696` (`SELECTION_MUTED_LABEL`) instead of their lane color. Search non-match and selection muting combine (a muted event that also misses the query still drops to 25% opacity). Dep neighbors in that filter keep their original fill and label brightness; the hovered block also keeps its color even when it is neither the selection nor a neighbor — otherwise a light hover fill with a dark label rendered gray is unreadable. Canvas uses `globalAlpha` for the search dim and swaps in the muted fill; WebGL rebuilds per-emphasis mesh layers with a per-layer color (gray when muted, else the lane color) and passes premul `uColor` RGB×alpha with alpha (hover exemption is applied in the overlay pass that paints the hover fill). Labels use the same alpha (overlay + Canvas fallback) and the muted label color on gray blocks; search non-matches omit labels. Clearing search and selection restores the original colors.

**Event fills.** Each lane has one base colour, and the three interaction states are derived from it in OKLCH (`src/domain/oklch.ts`) rather than hand-picked: `normal` = base, `hover` = `L + 0.33`, `selected` = `L + 0.33` with `C × 1.05`. Experiment: hover shares selection's lightness so the lift is unmissable; the chroma bump and the surrounding gray muting alone mark selection. `L` is perceptual, so one step reads the same on every lane. Requests outside sRGB — routine for the oranges at this lift — keep `L` and hue and give up chroma. A block that is both selected and hovered paints `selected` (`eventStateOf`), and its state fill renders over the muted surroundings.

Hover and selected sit on the same lightness. Earlier passes kept them `0.13` apart (`+0.25` / `+0.38`) or pushed hover alone to `+0.34`; this trial collapses the lightness gap on purpose.

**Collapsed-group summary events.** When a folder is collapsed, `filterCollapsedTree` attaches `summaryEvents` to that folder row. `rebuildLayout` lays them out on the folder's own lane as `LaidOutEvent`s with `summary: true` and the gray `SUMMARY_EVENT_FILL`. Both backends paint them as ordinary rounded event blocks in gray: the Canvas fallback paints them at full opacity, and the WebGL backend paints the whole folder-lane mesh gray. Summary bars are **interactive**: they are hit-testable, render an **italic** "N tasks" label (`taskCountLabel`), and lift to the OKLCH hover fill under the pointer (repainted by the overlay on the WebGL path). They are never selected (no white ring) and never dimmed by search/selection emphasis (the WebGL base mesh stays full-bright because summary events are skipped by the emphasis split). They never contribute to dependency or edge-magnet/measure paths (`findExactEdgeMatches` / `findExactEdgeMatchesAt` skip `summary` items; `nearestEventEdgeAtPoint` / `findHoverGap` still ignore folder lanes).

**Label contrast.** Event labels take their colour from the fill actually painted, flipping to `#000000` above `L 0.6` and `#ffffff` at or below — never chosen per state. The DOM equivalent of the same rule is `color: oklch(from var(--c) clamp(0, (0.6 - l) * 1000, 1) 0 0)`; the renderers cannot use it because there is no element to compute a style on.

Both lifts clear the threshold from a resting `L ≈ 0.50`, so **a label inverts as the pointer crosses its block**. That is accepted, not overlooked. An earlier revision held hover below the flip precisely to keep labels steady, and what it bought — a lift clipped to `≈ +0.09` — was too weak to notice, which is the defect that replaced it. Deriving the label from the painted fill rather than from the state is what makes the trade safe: however the lifts are retuned, a fill and its label cannot end up disagreeing about which side of the threshold they are on.

**Lane chrome.** Every event-sequence lane shares the same background fill (`LANE_FILL`, `#1f1f1f`); alternating zebra stripes are not used. The one leaf lane under the pointer fills `LANE_HOVER_FILL` (`#363636`) instead — AC-07's track half, matching the gutter row highlight so the two read as one continuous row. It is painted **in the background pass, behind events**, deliberately: composited over the lanes it would tint every event it crossed, and a lifted event fill already means hover on *that event* (AC-08). Both backends take it through `setHoveredLane`; folders never match, since the hit test returns leaves only. **Card / root group headers** paint a full-width band `rgb(42, 42, 42)` (`#2a2a2a`) under the DOM Card strips in `SwimlaneView`. Horizontal dividers (`#3a3a3a`) are drawn at the bottom of each group header and each lane (1 device px), aligned with the LaneGutter borders. WebGL draws the same uniform fill and divider rects; Canvas uses strokes at the same edges.

**Cursor.** Vertical cursor stroke uses `#317AF7` to match axis `.pr-cursor`. Swimlane paints the follow-bar as a DOM overlay in `SwimlaneView` (under Card strips); Canvas/WebGL renderers no longer stroke the cursor.

**WebGL intervals.** Analytical horizontal coverage-AA combined with SDF round-rect via `min(hCoverage, rrShape)`. The FS emits **straight RGB × coverage with alpha constant 1.0**, and blending is **additive** `(ONE, ONE, ONE, ONE)`: each overlapping event contributes `cov·dim·rgb`, accumulating the results of all fills at a pixel (no source-over compositing). All RGB/alpha factors are `ONE` because the output alpha is always 1.0, making `SRC_ALPHA` ≡ `ONE`. This is safe because the producer contract ([`swimlane-model.spec.md`](swimlane-model.spec.md) "Intra-lane exclusivity") states a lane never contains nested or intersecting events — their horizontal spans are mutually exclusive — so no same-color overdraw can accumulate within a lane; instead the accumulation is exactly what we want: every device pixel sums the event coverage of **all** events (across lanes) that intersect it. The sole exception is standalone Chrome-trace JSON, where `chromeTraceToSwimlane` does not de-nest call stacks, so one lane may overlap; there the additive fill degrades by saturating the overlap (dimmed/AA pixels brighten toward white), never wrapping or crashing. Interval endpoints are uploaded relative to `model.minTime` via `encodeIntervalPair`, keeping `end > start` after float32 rounding.

**Dependency curves.** On selection, WebGL draws an instanced cubic strip **2 device pixels** wide (one instance per link; pan/zoom via uniforms). Canvas fallback strokes the same cubic with a pred→succ linear gradient. Unlike the additive interval fills, curves render with **premultiplied source-over** `(ONE, ONE_MINUS_SRC_ALPHA, ONE, ONE_MINUS_SRC_ALPHA)`, matching `CURVE_FS`'s premultiplied output `{vColor·a, a}`. See [DependencyLinksLayer](../../src/ui/TimelineView/SwimlaneView/DependencyLinksLayer/DependencyLinksLayer.spec.md). `SwimlaneRenderer.setDependencyMode` / `setDependencyDepth` are optional; Canvas and WebGL implement them, and `SwimlaneCanvas` calls them with `?.`.

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
1. **PR-RENDER-010**: `eventEmphasis` returns search dim `alpha` 0.25 (miss) / 1 (hit) and `muted` true for non-selected/non-neighbor events under a selection; the hovered block stays unmuted under a selection; WebGL setSelection rebuilds emphasis layers and render does not throw.
1. **PR-RENDER-011**: Canvas and WebGL lane backgrounds use uniform fill `#1f1f1f` (no zebra striping).
1. **PR-RENDER-012**: Canvas and WebGL Card/group header bands use `LANE_GROUP_HEADER_FILL` (`#2a2a2a` / `rgb(42, 42, 42)`).
1. **PR-RENDER-013**: Selected event's predecessors/successors keep their original fill and label color; non-neighbors render solid dark-gray `#2C2C2C`.
1. **PR-RENDER-014**: `SwimlaneRenderer.setDependencyMode` / `setDependencyDepth` / `setHoveredLane` are optional (existing implementers stay valid).
1. **PR-RENDER-017**: `eventRadius` applies the CSS-px corner policy (1 below 4 CSS-px width, else 2) × `dpr` → device px; Canvas and WebGL share the same `shaders.ts` constants via one `uRR` vec3 uniform / `eventRadius`.
1. **PR-RENDER-017b**: `uRR` painted radii (`xy`) round to integer device px, but the switch threshold (`z`) is the exact `rrSwitchThreshold × dpr` (fractional dpr parity).
1. **PR-RENDER-018**: `snapEventRect` (device-px inputs) aligns all four edges to integer device pixels; min size 1 device px.
1. **PR-RENDER-019**: `resize(deviceW, deviceH, dpr)` sets `canvas.width/height` to device args without writing `canvas.style`; WebGL has no `uDpr` uniform.
1. **PR-RENDER-020**: `setHoveredLane` fills that one leaf row `LANE_HOVER_FILL` in the background pass on both backends, leaving every event fill untouched.
1. **PR-RENDER-020b**: WebGL overlay underpaint for non-resting blocks uses `LANE_HOVER_FILL` when that event's lane is the hovered row (else `LANE_FILL`), so a dimmed state fill composites over the same lane chrome Canvas uses.
1. **PR-RENDER-021**: `setSelection(selected, hovered)` paints each block the OKLCH state fill for its winning state, and each label the contrast colour of the fill beneath it.
1. **PR-RENDER-022**: Dependency curve stroke width is dpr-scaled via the shared `dependencyStrokeWidth(dpr)` helper (`max(1, round(2 × dpr))` device px = 2 CSS px), applied by both Canvas and WebGL; WebGL re-uploads curve instances on `dpr` change so curves re-anchor on browser zoom.
1. **PR-RENDER-023**: Selecting an event paints non-selected/non-neighbor blocks solid dark-gray `#2C2C2C` with label `#969696`, keeps the selected block's lifted state fill and its contrast label, and draws no white selection ring.
1. **PR-RENDER-024**: Collapsed-folder `summaryEvents` are laid out on the folder lane and painted gray; they are hit-testable (folder lanes resolve through their summary bars), map back to their grouping node via `summaryFolderId`, and are excluded from `findExactEdgeMatches` / `findExactEdgeMatchesAt`.
1. **PR-RENDER-025**: Summary bars render an italic "N tasks" label (`taskCountLabel`) and lift to the OKLCH hover fill under the pointer; they are never dimmed by search/selection and never selected/ringed.

## Edge Cases

- hitTest on empty space → null. Very narrow viewport → sub-pixel events still draw after snap to ≥1 device px.
- Backing-store size comes only from the host’s RO `devicePixelContentBoxSize` (passed into `resize`); it is never recomputed inside the renderer as `window.devicePixelRatio` × CSS size.
- Corner decision uses the **CSS-px** raw width at any dpr: WebGL compares device width against the exact `uRR.z` threshold (`rrSwitchThreshold × dpr`, unrounded), so the `rawW < 4 CSS px` cutoff is density-independent.

## Dependencies

[swimlane-model](./swimlane-model.spec.md), [view-state](./view-state.spec.md).

## Open

WebGL hybrid path is implemented (`WebGlSwimlaneRenderer` + Canvas overlay); Canvas remains the fallback when WebGL2 is unavailable.

## Changelog
- **2026-09-03** — Selection no longer draws a 2px white ring and no longer dims non-neighbors to 0.45×; instead, non-selected/non-neighbor events render solid dark-gray `#2C2C2C` with label `#969696` (`eventEmphasis` replaces `eventEmphasisDim`; `SELECTION_MUTED_FILL` / `SELECTION_MUTED_LABEL`). Selected event and its dep neighbors keep their state fills; search non-match dim (0.25) is unchanged.
- **2026-09-03** — Summary bars become interactive: italic "N tasks" label, hover lift, hit-testable; PR-RENDER-024 / PR-RENDER-025.
- **2026-09-03** — Collapsed-group summary events: gray `LaidOutEvent`s on folder lanes, non-interactive, never labeled/dimmed; `paintGroupBands`/ProfilerStep bands removed. PR-RENDER-024.
- **2026-09-02** — Dependency curve stroke is dpr-scaled via the shared `dependencyStrokeWidth(dpr)` helper (2 CSS px, min 1 device px), so Canvas and WebGL match the 2 CSS px selection stroke at any dpr; WebGL re-uploads curve instances on `dpr` change so curves re-anchor on browser zoom. (PR-RENDER-022)
- **2026-09-02** — PR-RENDER-020b: overlay underpaint respects `hoveredLaneId` (`LANE_HOVER_FILL` vs `LANE_FILL`) so dimmed state fills match Canvas over a hovered row.
- **2026-09-02** — Experiment: hover and selected share `L + 0.33`; selection still gets `C × 1.05` and the white ring.
- **2026-09-01** — Dropped the pressed state; blocks are `normal` / `hover` / `selected` only, and `setSelection` loses its third argument.
- **2026-09-01** — Hovered blocks are exempt from the selection dim (`eventEmphasisDim` `keepBright`); hover lightness restored to `L + 0.25`. The muddy labels on the oranges were the dim washing a light fill, not the fill being too dark — pushing hover to `+0.34` had been treating the symptom.
- **2026-09-01** — Hover goes to `L + 0.34` (`≈ 0.84`): `+0.25` was bright enough to spot but left dark labels muddy on the oranges. Selection stays at `+0.38`; the ring carries most of the distinction. *(Superseded the same day — see above.)*
- **2026-09-01** — Hover goes to `L + 0.25` and the label-flip clamp is removed with it: hover was reported as not registering, and holding it under the threshold was what kept it weak. Labels now invert under the pointer, which is the accepted cost. Hover sits `0.13` below selected.
- **2026-09-01** — Hover clamps to the resting fill's side of the `L 0.6` label flip, so labels no longer invert under a moving pointer. Its lift becomes `≈ +0.09` rather than the nominal `+0.14`; selection still flips, deliberately. *(Reverted the same day — see above.)*
- **2026-09-01** — PR-RENDER-021: event fills become OKLCH offsets from each lane's base (`normal` / `hover` / `selected +0.38, C×1.05`), replacing the sRGB 45% lift toward white. Labels now take contrast from the painted fill at an `L 0.6` flip instead of always being white; the 1.5px hover stroke is withdrawn, hover having been a fill change since AC-08.
- **2026-09-01** — PR-RENDER-020: `setHoveredLane` tints the hovered leaf row `#363636` (AC-07's track half). Painted in the background pass on both backends rather than as a DOM band over the canvas, which was the first attempt and tinted the events it crossed. `LANE_FILL` / `LANE_HOVER_FILL` replace the inline `#1f1f1f` literals.
- **2026-08-31** — WebGL interval fills switch to **additive** blending `(ONE, ONE, ONE, ONE)` with straight-RGB output (alpha constant 1.0): overlapping events accumulate `cov·dim·rgb`, replacing source-over premul. Safe because events within one lane never nest/intersect (mutually exclusive spans); each device pixel accumulates the event coverage of **all** events across lanes that intersect it. Dependency curves keep premultiplied source-over `(ONE, ONE_MINUS_SRC_ALPHA, ONE, ONE_MINUS_SRC_ALPHA)`.
- **2026-08-31** — Corner radius is now a CSS-pixel policy (`minRR`/`maxRR`/`rrSwitchThreshold` in `shaders.ts`): 1 CSS px when raw CSS width < 4, else 2 CSS px, then × dpr. WebGL uploads the `vec3` `uRR`: radii round to integer device px, threshold stays exact; Canvas `eventRadius(cssW, dpr)` uses the same constants. (PR-RENDER-017, PR-RENDER-017b)
- **2026-08-31** — WebGL FS: combine sudu `hCoverage` with SDF round-rect via `min` (not multiply).
- **2026-08-28** — WebGL: restore SDF round-rect on top of sudu horizontal coverage AA (radius 1/2 device px; `uYBounds` for Y).
- **2026-08-28** — WebGL: drop dead `uYBounds` (Y from vertex geometry only; FS coverage is `inside` alone).
- **2026-08-28** — WebGL VS: pass exact event edges in `vLrScreen`; per-vertex `floor`/`ceil` expand only (no +0.5/−0.5 gap inset).
- **2026-08-28** — WebGL: restore sudu analytical horizontal coverage AA (`floor`/`ceil` expand + event∩pixel `inside`); still source-over premul; round-rect still deferred.
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
