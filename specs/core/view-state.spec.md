# View State

<!--
  spec-id-prefix: PR-VIEW-*
  phase: MVP
  source: src/domain/viewState.ts
  test: tests/unit/viewState.spec.ts
-->

Pure functions managing swimlane viewport — zoom, pan, window boundaries, zoom-to-fit. All return new objects; none mutate inputs.

```ts
createViewState(model: SwimlaneModel | null | undefined): SwimlaneViewState
zoomAt(view: SwimlaneViewWindow, factor: number, anchorTime: number, bounds?: Bounds): SwimlaneViewWindow
panBy(view: SwimlaneViewWindow, deltaTime: number, bounds?: Bounds): SwimlaneViewWindow
zoomToFitWindow(model: SwimlaneModel | null | undefined): SwimlaneViewWindow
applyWindow(state: SwimlaneViewState, window: SwimlaneViewWindow): SwimlaneViewState
```

## Behavior

**Immutability.** All functions return new objects. The parent ProfilingReport uses `{ ...viewState.value, ...patch }` to trigger Vue reactivity — mutating in place would prevent the deep watcher in SwimlaneCanvas from detecting changes.

**Initialization.** `createViewState` initializes from a SwimlaneModel, defaulting to zoom-to-fit with zero scroll, no selection/hover, empty search, aside visible, no playhead.

**Zoom.** `zoomAt` zooms around an anchor time point. Factor >1 zooms in, <1 zooms out. Span is clamped to a minimum of 1. With bounds, the zoomed window never exceeds the bounds edges — if the zoomed span exceeds the full bounds, returns the full bounds.

**Pan.** `panBy` shifts the viewport by delta time units. Positive delta moves later times into view. With bounds, the window is clamped to stay within bounds edges.

**Bounds protection.** The caller adds a +1 guard when `maxTime === minTime` to prevent division by zero during zoom calculations.

## Acceptance Criteria

1. **PR-VIEW-001**: createViewState with valid model initializes window covering full timeline.
1. **PR-VIEW-002**: zoomToFitWindow expands viewport to full timeline span.
1. **PR-VIEW-003**: Combined zoom+pan with bounds clamping produces correct viewport.

## Edge Cases

- null/undefined model → zoomToFitWindow returns {startTime:0, endTime:1, scrollY:0}.
- Zoom factor ≤0 → span clamped to MIN_WINDOW=1.
- Pan beyond bounds → clamped to edges.

## Dependencies

[swimlane-model](./swimlane-model.spec.md).

## Open

Multi-touch pinch zoom (P2).

## Changelog
- **2026-08-05** — Initial spec. Core behaviors established.
