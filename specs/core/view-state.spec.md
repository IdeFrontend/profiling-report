# View State

| spec-id-prefix |
|----------------|
| PR-VIEW-*      |

Pure functions managing swimlane viewport — zoom, pan, window boundaries, zoom-to-fit. All return new objects; none mutate inputs.

```ts
createViewState(model: SwimlaneModel | null | undefined): SwimlaneViewState
zoomAt(view: SwimlaneViewWindow, factor: number, anchorTime: number, bounds?: Bounds): SwimlaneViewWindow
panBy(view: SwimlaneViewWindow, deltaTime: number, bounds?: Bounds): SwimlaneViewWindow
zoomToFitWindow(model: SwimlaneModel | null | undefined): SwimlaneViewWindow
applyWindow(state: SwimlaneViewState, window: SwimlaneViewWindow): SwimlaneViewState
measureFocusWindow(range: MeasureRange, bounds: Bounds, scrollY?: number): SwimlaneViewWindow
zoomPercentFromSpan(span: number, fullSpan: number): number
spanFromZoomPercent(pct: number, fullSpan: number): number
```

## Behavior

**Immutability.** All functions return new objects. The parent ProfilingReport uses `{ ...viewState.value, ...patch }` to trigger Vue reactivity — mutating in place would prevent the deep watcher in SwimlaneCanvas from detecting changes.

**Initialization.** `createViewState` initializes from a SwimlaneModel, defaulting to zoom-to-fit with zero scroll, no selection/hover, empty search, aside visible, no playhead, `measureMode: false`, `measureRange: null`.

**Measure (M2).** `setMeasureMode` / `setMeasureRange` / `clearMeasure` update measure fields immutably. Range endpoints are order-normalized (`startTime <= endTime`, ns units matching the viewport). Clearing / disabling measure nulls the range. Local overlay only until Q22. `measureFocusWindow` centers a measured range so it spans half the visible width (25% padding each side), clamps to bounds, and fits the full bounds when 2× duration exceeds the trace.

**Zoom.** `zoomAt` zooms around an anchor time point. Factor >1 zooms in, <1 zooms out. Span is clamped to a minimum of 1 (`MIN_WINDOW`). With bounds, the zoomed window never exceeds the bounds edges — if the zoomed span exceeds the full bounds, returns the full bounds.

**Shared zoom range (toolbar slider).** `zoomPercentFromSpan` / `spanFromZoomPercent` map the same extremes as wheel/`zoomAt`: slider 0 = fit (`fullSpan`), slider 100 = `MIN_WINDOW`. Log2 interpolate with `maxRatio = fullSpan / MIN_WINDOW` (not a hard 100× cap).

**Pan.** `panBy` shifts the viewport by delta time units. Positive delta moves later times into view. With bounds, the window is clamped to stay within bounds edges.

**Bounds protection.** The caller adds a +1 guard when `maxTime === minTime` to prevent division by zero during zoom calculations.

## Acceptance Criteria

1. **PR-VIEW-001** — zoomToFitWindow covers model min/max.
2. **PR-VIEW-002** — zoomAt shrinks around anchor.
3. **PR-VIEW-003** — panBy shifts within bounds.
4. **PR-VIEW-004** — createViewState initializes measure off.
5. **PR-VIEW-005** — setMeasureRange normalizes; clearMeasure resets.
6. **PR-VIEW-006** — measureFocusWindow centers at half span.
7. **PR-VIEW-007** — measureFocusWindow clamps / fits when 2× exceeds.
8. **PR-VIEW-008** — zoomPercent extremes: 0 ↔ full, 100 ↔ MIN_VIEW_WINDOW.
9. **PR-VIEW-009** — zoomPercent ↔ span round-trip.
10. **PR-VIEW-010** — slider max matches zoomAt floor.

## Edge Cases

- null/undefined model → zoomToFitWindow returns {startTime:0, endTime:1, scrollY:0}.
- Zoom factor ≤0 → span clamped to MIN_WINDOW=1.
- Pan beyond bounds → clamped to edges.

## Dependencies

[swimlane-model](./swimlane-model.spec.md).

## Open

Multi-touch pinch zoom (P2). M2 measure fields.

## Changelog
- **2026-08-21** — Shared zoomPercent ↔ span helpers; slider 100 = MIN_WINDOW (PR-VIEW-008…010).
- **2026-08-21** — Document measureFocusWindow; PR-VIEW-006/007.
- **2026-08-07** — Note M2 measure as planned; no AC until coded.
- **2026-08-05** — Initial spec. Core behaviors established.
