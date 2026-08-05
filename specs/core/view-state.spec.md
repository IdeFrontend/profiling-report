# View State

<!--
  spec-id-prefix: PR-VIEW-*
  phase: MVP
  source: src/domain/viewState.ts
  test: tests/unit/viewState.spec.ts
-->

Manage swimlane viewport — zoom, pan, window boundaries, zoom-to-fit.

```ts
createViewState(model: SwimlaneModel | null | undefined): SwimlaneViewState
zoomAt(view: SwimlaneViewWindow, factor: number, anchorTime: number, bounds?: Bounds): SwimlaneViewWindow
panBy(view: SwimlaneViewWindow, deltaTime: number, bounds?: Bounds): SwimlaneViewWindow
zoomToFitWindow(model: SwimlaneModel | null | undefined): SwimlaneViewWindow
applyWindow(state: SwimlaneViewState, window: SwimlaneViewWindow): SwimlaneViewState
```

| Parameter | Type | Description |
|-----------|------|-------------|
| model | SwimlaneModel or null/undefined | Used to compute initial window |
| factor | number | >1 zoom in, <1 zoom out |
| anchorTime | number | Zoom anchor in time units |
| deltaTime | number | Pan offset in time units |

**Behavior:** createViewState initializes from a SwimlaneModel, defaulting to zoom-to-fit. Zoom anchored at a specific time, clamped to optional bounds. Pan shifts viewport by delta, clamped. Minimum span: 1 time unit.

## Acceptance Criteria

1. **PR-VIEW-001**: createViewState with valid model initializes window covering full timeline.
1. **PR-VIEW-002**: zoomToFitWindow expands viewport to full timeline span.
1. **PR-VIEW-003**: Combined zoom+pan with bounds clamping produces correct viewport.

## Edge Cases

- null/undefined model → zoomToFitWindow returns {startTime:0, endTime:1, scrollY:0}.
- Zoom factor ≤0 → span clamped to MIN_WINDOW=1.
- Pan beyond bounds → clamped to edges.

**Dependencies:** [swimlane-model](./swimlane-model.spec.md).

**Open:** Multi-touch pinch zoom (P2).
