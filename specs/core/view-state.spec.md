# View State

<!--
  spec-id-prefix: PR-VIEW-*
  phase: MVP
  source: src/domain/viewState.ts
  test: tests/unit/viewState.spec.ts
-->

Manage the swimlane viewport — zoom, pan, window boundaries, zoom-to-fit. All view state mutations are pure functions that return new objects.

```ts
createViewState(model: SwimlaneModel | null | undefined): SwimlaneViewState
zoomAt(view: SwimlaneViewWindow, factor: number, anchorTime: number, bounds?: Bounds): SwimlaneViewWindow
panBy(view: SwimlaneViewWindow, deltaTime: number, bounds?: Bounds): SwimlaneViewWindow
zoomToFitWindow(model: SwimlaneModel | null | undefined): SwimlaneViewWindow
applyWindow(state: SwimlaneViewState, window: SwimlaneViewWindow): SwimlaneViewState
```

## Behavior

**Immutability.** All functions return new objects — never mutate inputs. This is required because the parent ProfilingReport uses `{ ...viewState.value, ...patch }` to trigger Vue reactivity. Mutating in place would prevent the deep watcher in SwimlaneCanvas from detecting changes.

**Initialization.** `createViewState(model)` initializes from a SwimlaneModel. It calls `zoomToFitWindow` to compute the initial viewport covering the full timeline, then creates the full state with `scrollY: 0`, no selection, no hover, empty search, aside visible, and no playhead.

**Zoom.** `zoomAt` zooms around an anchor time point (cursor position for wheel zoom, viewport center for toolbar buttons). Factor > 1 zooms in; factor < 1 zooms out. The span is clamped to a minimum of 1 time unit. When bounds are provided, the zoomed window is clamped to never exceed the bounds edges — if the zoomed span exceeds the full bounds span, it returns the full bounds instead.

**Pan.** `panBy` shifts the viewport by delta time units. Positive delta moves later times into view (scrolls right). With bounds, the window is clamped to stay within bounds — panning past the left edge clamps startTime to bounds.minTime; panning past the right edge clamps endTime to bounds.maxTime.

**Bounds protection.** The ProfilingReport computes bounds as `{ minTime: model.minTime, maxTime: Math.max(model.minTime + 1, model.maxTime) }` to prevent division by zero when `maxTime === minTime`.

## Acceptance Criteria

1. **PR-VIEW-001**: createViewState with valid model initializes window covering full timeline.
1. **PR-VIEW-002**: zoomToFitWindow expands viewport to full timeline span.
1. **PR-VIEW-003**: Combined zoom+pan with bounds clamping produces correct viewport.

## Edge Cases

- null/undefined model → zoomToFitWindow returns {startTime:0, endTime:1, scrollY:0}.
- Zoom factor ≤0 → span clamped to MIN_WINDOW=1 (effectively zoomed in to minimum).
- Pan beyond bounds → window clamped to bounds edges.
- Model with maxTime == minTime → bounds clamp adds +1 to maxTime.

**Dependencies:** [swimlane-model](./swimlane-model.spec.md).

**Open:** Multi-touch pinch zoom (P2).
