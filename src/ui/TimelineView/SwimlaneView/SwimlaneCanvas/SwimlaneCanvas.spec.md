# SwimlaneCanvas

| spec-id-prefix |
|----------------|
| PR-CANVAS-*    |

Vue wrapper around `CanvasSwimlaneRenderer`. Translates mouse/touch events into selection, hover, pan, and zoom signals.

## Inputs

**model** carries the complete `SwimlaneModel` (processes, threads, events, time bounds) or `null` when no data is loaded. **view** carries the current `SwimlaneViewWindow` (`{ startTime, endTime, scrollY }`). **selectedEventId** and **hoveredEventId** drive highlight rendering. **searchQuery** drives event name filtering in the renderer. **dependencyMode** and **dependencyDepth** filter which predecessor/successor curves and undimmed neighbors are shown.

## Outputs

Seven interaction events: **select** fires with a `SwimEvent` (or null) on click (post-4px-gate). **hover** fires on pointermove with the hovered event plus `clientX`/`clientY` for tooltip positioning. **cursor** fires with `{ time, xRatio }` for playhead placement. **pan** fires with a time-unit delta during drag. **zoom** fires with `[factor, anchorTime]` on Ctrl+wheel. **scroll-y** fires with the vertical scroll offset. **set-playhead** fires with a time value on every pointerdown (before the 4px drag gate, before hit test). The parent ProfilingReport translates all of these into viewport state changes.

## Behavior

**Canvas lifecycle.** The renderer is created eagerly, the canvas element is attached on mount (initializing the 2D context), and disposed on unmount. A `ResizeObserver` triggers `renderer.resize()` when the container size changes, accounting for `devicePixelRatio`. After a buffer resize (which clears pixels), paint runs in the same turn — not deferred to the next animation frame — so gutter/aside drag does not flash a blank swimlane.

**Scroll model.** The container uses `overflow: hidden` with a synthetic scroll mechanism: a sizer div sets the total content height, and `localScrollY` tracks the actual scroll offset. The drawing surface is sized to the **visible viewport** only; lanes are scrolled via `scrollY` in the renderer.

**Pointer translation.** `pointerdown` records the starting position. `pointermove` performs hitTest and emits `hover` (with clientX/clientY for tooltip positioning) and `cursor` (time + xRatio for playhead). While dragging **and not in measureMode**, every move emits `pan` in time units. On `pointerup`, if total movement <=4px and not measuring, `hitTest` is called and the result emitted as `select`.

**Measure mode (M2).** When `measureMode` is true, drag sets `measureRange` (`update:measureRange`) instead of pan/select. The overlay dims the swimlanes **outside** the measured span with a dark fade, draws a **gray** 1px border at each selection edge, and renders a **double-sided horizontal arrow** (`←—[Δt]—→`) with a blue Δt pill at the top of the selection. Pan is suppressed. Aside sync is out of scope until Q22. `pointerleave` must not clear the measure anchor while a measure drag is active (pointer capture may keep delivering move/up outside the element). External cancel (`measureMode` false / `measureRange` null via Esc or toolbar) clears local drag/anchor immediately; a `measureGestureActive` flag suppresses pan and select until `pointerup`.

**Reactivity.** A deep watcher on the viewport prop calls `renderer.setView()` and `renderer.render()` on every change. Model changes call `renderer.setModel()`. Selection/hover/`dependencyMode`/`dependencyDepth` changes trigger render only (layout unchanged; no page reload).

## Acceptance Criteria

1. **PR-CANVAS-001** — Creates canvas element and 2D context.
2. **PR-CANVAS-002** — Canvas persists after model change.
3. **PR-CANVAS-003** — In measureMode, drag emits measureRange; pan is not emitted.
4. **PR-CANVAS-004** — Measure overlay shows fade, gray borders, arrow, and duration label when measureRange is set.
5. **PR-CANVAS-005** — `pointerleave` during an active measure drag does not abort the drag or allow select.
6. **PR-CANVAS-006** — Clearing measureMode/measureRange mid-drag does not pan or select on subsequent move/up.

## Edge Cases

| State | Behavior |
|---|---|
| model is null | Empty canvas, no error |
| model has 0 processes | Empty canvas |
| view.endTime <= view.startTime | Renderer handles gracefully |
| `maxTime === minTime` | Bounds clamp adds +1 |
| Sub-pixel container size | Canvas minimum is 1×1 |
| hitTest on empty space | Returns null |

## Visual

Crops: [`visual/event-blocks.png`](./visual/event-blocks.png), [`visual/search-highlight.png`](./visual/search-highlight.png), [`visual/measure-overlay.png`](./visual/measure-overlay.png), [`visual/multi-height.png`](./visual/multi-height.png) — [`visual/provenance.yaml`](./visual/provenance.yaml).

## Design sketches

- [event-blocks](./visual/event-blocks.png) — from `v930/entry`
- [search-highlight](./visual/search-highlight.png) — from `v930/search-highlight`
- [measure-overlay](./visual/measure-overlay.png) — from `v930/task-measure-mode`
- [multi-height](./visual/multi-height.png) — from `v930/task-multi-height`
- [Kernel block timeline](../../../../../docs/ui/source/v930/entry.jpeg) — full frame
- [Task measure mode](../../../../../docs/ui/source/v930/task-measure-mode.jpeg) — full frame

## Dependencies

[swimlane-renderer](../../../../../specs/core/swimlane-renderer.spec.md), [swimlane-model](../../../../../specs/core/swimlane-model.spec.md).

**Input formats:** [METRICS_AND_TRACE.md](../../../../../docs/formats/METRICS_AND_TRACE.md) (trace.json Chrome Trace events).

## Changelog
- **2026-08-12** — Measure overlay corrected to match sketch: fade outside, gray borders, double-sided arrow.
- **2026-08-10** — Flush paint after canvas resize (no blink on panel drag); draw surface = viewport height.
- **2026-08-07** — External measure cancel clears local drag; PR-CANVAS-006.
- **2026-08-07** — Measure drag survives pointerleave; PR-CANVAS-005.
- **2026-08-07** — Note M2 measure as planned; no AC until coded.
- **2026-08-05** — Initial spec. Core behaviors established.
