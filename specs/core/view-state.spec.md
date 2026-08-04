# View State

<!--
  metadata
  spec-id-prefix: PR-VIEW-*
  phase: MVP
  owner: -
  last-updated: 2026-08-04
  source: src/domain/viewState.ts
  test: tests/unit/viewState.spec.ts
-->

## Purpose

Manage the swimlane viewport state — zoom, pan, window boundaries, and zoom-to-fit calculations.

## Inputs / Outputs

```ts
createViewState(model: SwimlaneModel | null | undefined): SwimlaneViewState
zoomAt(view: SwimlaneViewWindow, factor: number, anchorTime: number, bounds?: Bounds): SwimlaneViewWindow
panBy(view: SwimlaneViewWindow, deltaTime: number, bounds?: Bounds): SwimlaneViewWindow
zoomToFitWindow(model: SwimlaneModel | null | undefined): SwimlaneViewWindow
applyWindow(state: SwimlaneViewState, window: SwimlaneViewWindow): SwimlaneViewState
```

| Parameter | Type | Description |
|-----------|------|-------------|
| model | SwimlaneModel or null/undefined | Timeline model used to compute initial window |
| factor | number | Zoom multiplier (>1 zoom in, <1 zoom out) |
| anchorTime | number | Zoom anchor point in time units |
| deltaTime | number | Pan offset in time units |

## Behavior

- createViewState initializes view state from a SwimlaneModel, defaulting to zoom-to-fit.
- Zoom is anchored at a specific time point; clamped to optional bounds.
- Pan shifts the viewport by delta; clamped to optional bounds.
- zoomToFitWindow returns window covering the full timeline span.
- applyWindow sets explicit start/end boundaries on an existing state.
- Viewport minimum span is 1 time unit.

## Acceptance Criteria

1. **PR-VIEW-001**: createViewState with a valid model initializes window covering the full timeline.
1. **PR-VIEW-002**: zoomToFitWindow expands viewport to cover the full timeline.
1. **PR-VIEW-003**: Combined zoom + pan operations with bounds clamping produce correct viewport.

## Edge Cases

- null/undefined model — zoomToFitWindow returns {startTime:0, endTime:1, scrollY:0}.
- Zoom factor less than or equal to 0 — span is clamped to MIN_WINDOW=1.
- Pan beyond bounds — clamped to bounds edges.
- applyWindow with zero span — preserved (caller responsibility).

## Dependencies

- [docs/specs/ui/INTERACTIONS.md] — gesture mapping.
- [docs/specs/architecture/COMPONENTS.md] — SwimlaneViewState definition.

## Open Questions

- Multi-touch pinch zoom (P2).
