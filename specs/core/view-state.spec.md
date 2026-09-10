# View State

| spec-id-prefix |
|----------------|
| PR-VIEW-*      |

Pure functions managing swimlane viewport — zoom, pan, window boundaries, zoom-to-fit. All return new objects; none mutate inputs.

```ts
createViewState(model: SwimlaneModel | null | undefined): SwimlaneViewState
pinLane(state: SwimlaneViewState, laneId: string): SwimlaneViewState
unpinLane(state: SwimlaneViewState, laneId: string): SwimlaneViewState
pinOverview(state: SwimlaneViewState, seriesId: string): SwimlaneViewState
unpinOverview(state: SwimlaneViewState, seriesId: string): SwimlaneViewState
zoomAt(view: SwimlaneViewWindow, factor: number, anchorTime: number, bounds?: Bounds, minSpan?: number): SwimlaneViewWindow
panBy(view: SwimlaneViewWindow, deltaTime: number, bounds?: Bounds): SwimlaneViewWindow
zoomToFitWindow(model: SwimlaneModel | null | undefined): SwimlaneViewWindow
applyWindow(state: SwimlaneViewState, window: SwimlaneViewWindow): SwimlaneViewState
measureFocusWindow(range: MeasureRange, bounds: Bounds, scrollY?: number): SwimlaneViewWindow
zoomPercentFromSpan(span: number, fullSpan: number, minSpan?: number): number
spanFromZoomPercent(pct: number, fullSpan: number, minSpan?: number): number
minSpanForPrecision(fullSpan: number, widthPx: number): number
```

## Behavior

**Immutability.** All functions return new objects. The parent ProfilingReport uses `{ ...viewState.value, ...patch }` to trigger Vue reactivity — mutating in place would prevent the deep watcher in SwimlaneCanvas from detecting changes.

**Initialization.** `createViewState` initializes from a SwimlaneModel, defaulting to zoom-to-fit with zero scroll, no selection/hover, empty **pinnedLaneIds**, empty **pinnedOverviewIds**, empty search, aside visible, no playhead, `measureMode: false`, `measureRange: null`.

**Pinned lanes.** **pinnedLaneIds** holds globally unique leaf lane ids in pin order (session-local). No Card/process grouping in state — pins may span multiple Cards or groups; cross-card pin order is preserved in the array. Gutter pushpin and context-menu **Pin row** (Ctrl+P) are alternate affordances for the same list — not separate pin state. `pinLane` appends an id when absent (idempotent). `unpinLane` removes an id when present. Neither mutates the swim tree — duplicates are a view concern ([`SwimlaneView.spec.md`](../../src/ui/TimelineView/SwimlaneView/SwimlaneView.spec.md), [`LaneGutter.spec.md`](../../src/ui/TimelineView/SwimlaneView/LaneGutter/LaneGutter.spec.md)).

**Pinned overview series.** **pinnedOverviewIds** holds `OverviewSeries.id` values in pin order (session-local; PyPTO counter-thread pin parity). `pinOverview` / `unpinOverview` mirror lane helpers. Sticky duplicates render **above** the pinned-lane strip and **above** the scrolling swim body; originals remain in the 统计分析 section ([`OverviewCharts.spec.md`](../../src/ui/TimelineView/OverviewCharts/OverviewCharts.spec.md)).

**Measure (M2).** `setMeasureMode` / `setMeasureRange` / `clearMeasure` update measure fields immutably. Range endpoints are order-normalized (`startTime <= endTime`, ns units matching the viewport). Clearing / disabling measure nulls the range. Local overlay only — does not drive aside recompute. `measureFocusWindow` centers a measured range so it spans half the visible width (25% padding each side), clamps to bounds, and fits the full bounds when 2× duration exceeds the trace.

**Zoom.** `zoomAt` zooms around an anchor time point. Factor >1 zooms in, <1 zooms out. Span is clamped to a minimum of 1 (`MIN_WINDOW`), or to the caller-supplied `minSpan` floor when provided. With bounds, the zoomed window never exceeds the bounds edges — if the zoomed span exceeds the full bounds, returns the full bounds.

**Shared zoom range (toolbar slider).** `zoomPercentFromSpan` / `spanFromZoomPercent` map the same extremes as wheel/`zoomAt`: slider 0 = fit (`fullSpan`), slider 100 = the zoom floor (`minSpan`, default `MIN_WINDOW`). Log2 interpolate with `maxRatio = fullSpan / minSpan` (not a hard 100× cap). `minSpan` must be passed consistently to both helpers and `zoomAt`; the default keeps the legacy `MIN_WINDOW` floor.

**fp32 precision floor (PR-VIEW-020).** GPU event coords are stored as float32 relative to `model.minTime`, so their magnitude ≈ the trace span `fullSpan`. At one magnitude step the representable spacing is `ulp(fullSpan) = 2^floor(log2(fullSpan)) · 2^-23`. The rasterizer resolves X in **device px**, so at a view port of width `widthPx` device px a single ULP of `start` moves the left edge by `pxPerUlp = ulp · widthPx / span`. `minSpanForPrecision(fullSpan, widthPx)` returns the smallest span with `pxPerUlp ≤ 1` device px (`≥ ulp · widthPx`), never below `MIN_WINDOW`. The caller (ProfilingReport) passes this as the `minSpan` floor to `zoomAt` / `spanFromZoomPercent` / `zoomPercentFromSpan` so wheel, keyboard, and slider zoom-in cannot reach multi-device-pixel jumps; the width is the canvas device width (`trackWidth·dpr`). (A ¼px target would multiply the floor by 4 — allowing 4× less zoom-in.)

**Pan.** `panBy` shifts the viewport by delta time units. Positive delta moves later times into view. With bounds, the window is clamped to stay within bounds edges.

**Keyboard navigation (W/S/A/D).** `keyboardPanStepTime(span, trackWidth)` converts a fixed **30 px** pan step (PyPTO `moveStep`) into a time delta: `KEYBOARD_PAN_STEP_PX / trackWidth × span`. `trackWidth` (and `span`) are clamped to a minimum of 1 so the step is always positive and finite. The parent maps `W`/`S` to zoom-in/out around the cursor (viewport center when no cursor is set) and `A`/`D` to `panBy(±step)`; the default `key` values are `w`/`s`/`a`/`d` (PyPTO `ZoomInShortcut` / `ZoomOutShortcut` / `leftmoveShortcut` / `rightmoveShortcut`).

**Zoom-to-fit.** `zoomToFitWindow` spans `[model.minTime, model.maxTime]` (data span). Display labels use `minTime` as origin so the left edge reads `0`, matching PyPTO / Perfetto Timecode defaults.

**Bounds protection.** The caller adds a +1 guard when `maxTime === minTime` to prevent division by zero during zoom calculations.

## Acceptance Criteria

1. **PR-VIEW-001** — zoomToFitWindow covers model minTime through maxTime.
2. **PR-VIEW-002** — zoomAt shrinks around anchor.
3. **PR-VIEW-003** — panBy shifts within bounds.
4. **PR-VIEW-004** — createViewState initializes measure off.
5. **PR-VIEW-005** — setMeasureRange normalizes; clearMeasure resets.
6. **PR-VIEW-006** — measureFocusWindow centers at half span.
7. **PR-VIEW-007** — measureFocusWindow clamps / fits when 2× exceeds.
8. **PR-VIEW-008** — zoomPercent extremes: 0 ↔ full, 100 ↔ MIN_VIEW_WINDOW.
9. **PR-VIEW-009** — zoomPercent ↔ span round-trip.
10. **PR-VIEW-010** — slider max matches zoomAt floor.
11. **PR-VIEW-011** — zoomToFitWindow for `minTime === maxTime` uses `[minTime, minTime + MIN_WINDOW]` (aligned with bounds).
12. **PR-VIEW-013** — createViewState initializes empty **pinnedLaneIds**.
13. **PR-VIEW-014** — pinLane appends id when absent.
14. **PR-VIEW-015** — unpinLane removes id when present.
15. **PR-VIEW-016** — `keyboardPanStepTime` maps `KEYBOARD_PAN_STEP_PX` (30 px) to a time delta proportional to the visible span: `30 / trackWidth × span`.
16. **PR-VIEW-017** — `keyboardPanStepTime` clamps `trackWidth ≤ 0` and `span ≤ 0` to a minimum of 1, returning a positive finite step (no NaN / division by zero).
17. **PR-VIEW-018** — createViewState initializes empty **pinnedOverviewIds**.
18. **PR-VIEW-019** — pinOverview appends id when absent; unpinOverview removes when present.
19. **PR-VIEW-020** — `minSpanForPrecision` floors at `ULP(fullSpan)·widthPx` (≤1 device px per ULP) and never below `MIN_WINDOW`.
20. **PR-VIEW-021** — slider 100 ↔ custom `minSpan`; `zoomAt` / slider share the precision floor.
21. **PR-VIEW-022** — `spanFromZoomPercent` ↔ `zoomPercentFromSpan` round-trip with a custom `minSpan`.
## Edge Cases

- null/undefined model → zoomToFitWindow returns {startTime:0, endTime:1, scrollY:0}.
- Degenerate `minTime === maxTime` → zoomToFitWindow returns `{startTime: minTime, endTime: minTime + MIN_WINDOW}` (aligned with ProfilingReport bounds `minTime + 1`).
- Zoom factor ≤0 → span clamped to MIN_WINDOW=1.
- Pan beyond bounds → clamped to edges.
- `keyboardPanStepTime` with a zero/negative `trackWidth` or `span` → clamped to a positive step (no NaN).
- pinLane on already-pinned id → unchanged order (idempotent).
- unpinLane on absent id → no-op.
- Pin id persists in **pinnedLaneIds** while its row is hidden (collapsed ancestor); **pinned strip stays visible** (built from the full swim model, not collapse-filtered `displaySwim`).
- pinOverview / unpinOverview same idempotent / no-op rules as lanes.

## Dependencies

[swimlane-model](./swimlane-model.spec.md).

## Open

M2 measure fields.

## Changelog
- **2026-09-10** — fp32 precision floor: `minSpanForPrecision` + optional `minSpan` on `zoomAt` / `zoomPercentFromSpan` / `spanFromZoomPercent` (`PR-VIEW-020`…`022`); defaults keep the legacy `MIN_WINDOW` floor.
- **2026-09-08** — **pinnedOverviewIds** + pinOverview/unpinOverview (`PR-VIEW-018` / `019`); PyPTO counter-pin parity.
- **2026-09-07** — Trackpad pinch zoom / two-finger horizontal pan via native `wheel` (PyPTO parity; see SwimlaneCanvas `PR-CANVAS-068`).- **2026-09-03** — Keyboard navigation (W/S/A/D): `keyboardPanStepTime` + `KEYBOARD_PAN_STEP_PX` (`PR-VIEW-016` / `017`). Resolves Q19 gesture parity.
- **2026-08-31** — Pinned strip stays visible under ancestor collapse (full swim as pin source).
- **2026-08-31** — Renumber pin ACs to `PR-VIEW-013`…`015` (avoid collision with #31 `PR-VIEW-012`).
- **2026-08-27** — Gutter pushpin and context-menu Pin row share **pinnedLaneIds**.
- **2026-08-27** — Cross-card **pinnedLaneIds**; pin persists while row hidden by collapse.
- **2026-08-27** — **pinnedLaneIds** + pinLane/unpinLane helpers (`PR-VIEW-013`…`015`). Tests deferred until implementation.
- **2026-08-25** — Degenerate minTime===maxTime fit stays in minTime space (PR-VIEW-011).
- **2026-08-25** — zoomToFit restored to `[minTime, maxTime]`; display origin is minTime (PyPTO/Perfetto default).
- **2026-08-24** — zoomToFit starts at producer t=0 (events align with absolute axis/tooltip).
- **2026-08-21** — Document measureFocusWindow; PR-VIEW-006/007.
- **2026-08-07** — Note M2 measure as planned; no AC until coded.
- **2026-08-05** — Initial spec. Core behaviors established.
