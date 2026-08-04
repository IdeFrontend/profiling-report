# View State

<!--
  metadata
  spec-id-prefix: PR-VIEW-*
  phase: MVP
  owner: -
  last-updated: 2026-08-04
  source: src/core/viewState.ts
  test: tests/unit/viewState.spec.ts
-->

## Purpose

Manage the swimlane viewport state — zoom, pan, window boundaries, and zoom-to-fit calculations.

## Inputs / Outputs

```ts
createViewState(windowMs: number, totalUs: number): SwimlaneViewState
zoomAt(state: SwimlaneViewState, factor: number, anchorUs: number): SwimlaneViewState
panBy(state: SwimlaneViewState, deltaUs: number): SwimlaneViewState
zoomToFitWindow(state: SwimlaneViewState): SwimlaneViewState
applyWindow(state: SwimlaneViewState, startUs: number, endUs: number): SwimlaneViewState
```

| Parameter | Type | Description |
|-----------|------|-------------|
| windowMs | number | Initial visible window width in ms |
| totalUs | number | Total timeline span in us |
| factor | number | Zoom multiplier (>1 zoom in, <1 zoom out) |
| anchorUs | number | Zoom anchor point in us |

**Returns**: New SwimlaneViewState with updated viewport.

## Behavior

- Zoom is anchored at a specific time point.
- Pan shifts the viewport by delta in us.
- zoomToFitWindow sets viewport to cover the full timeline.
- applyWindow sets explicit start/end boundaries.
- Viewport is clamped to total timeline bounds.

## Acceptance Criteria

1. **PR-VIEW-001**: createViewState initializes with correct window and total bounds.
1. **PR-VIEW-002**: zoomToFitWindow expands viewport to cover the full timeline.
1. **PR-VIEW-003**: Combined zoom + pan operations produce correct viewport.

## Edge Cases

- Zoom factor less than or equal to 0 — clamped to minimum.
- Pan beyond timeline bounds — clamped.
- applyWindow with start > end — swap or reject.

## Dependencies

- [docs/specs/ui/INTERACTIONS.md] — gesture mapping.
- [docs/specs/architecture/COMPONENTS.md] — SwimlaneViewState definition.

## Open Questions

- Multi-touch pinch zoom (P2).
