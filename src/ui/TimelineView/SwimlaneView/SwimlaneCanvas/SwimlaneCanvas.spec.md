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

**Pointer translation.** `pointerdown` records the starting position. `pointermove` performs hitTest and emits `hover` (with clientX/clientY for tooltip positioning) and `cursor` (time + xRatio for playhead). The swimlane cursor **always** magnetizes to the nearest in-lane event start/end within ~10px (leaf lane under the pointer); outside that threshold it uses linear `timeAtX`. A short blue snap stem (`measure-edge-snap`) marks the magnetized edge while the hit is active; the magnetized event is treated as hovered (tooltip / highlight) and is selected on click even when the pointer is slightly outside the block. **Ctrl/Cmd+wheel** zooms around the stuck timestamp (magnetized event edge, or hovered measure-border time), so the edge stays at its screen X and the pointer↔edge gap is preserved. While dragging **and not in measureMode**, every move emits `pan` in time units. On `pointerup`, if total movement <=4px and not measuring, `hitTest` (or the magnetized event) is emitted as `select`.

**Measure mode (M2).** When `measureMode` is true, pan and `select` are suppressed. **Hover** over an event shows two non-interactive **gray** full-height preview stems at the event’s true `startTime` / `endTime` (omit an edge outside the view; no fades). **Click** (move ≤4px) over an event snaps `measureRange` to that event’s borders via `update:measureRange` only — never `select`. Borders tween (~180ms ease; instant with reduced motion): from a prior range when one exists, otherwise shrink from the visible view window. Click on empty space clears the range: borders expand to the visible view window (~180ms), then `measureRange` becomes `null` (instant clear when reduced motion or when the range already spans the view). During appear/clear (view↔range) tweens, emit `suppress-measure-dt` so the axis Δt arrow/label stay hidden; range-to-range tweens keep Δt visible. **Drag** (move >4px) starts freeform create (anchor at pointerdown X, magnetized); `pointerdown` does **not** emit a range until the threshold is crossed. The moving create/resize edge uses the same 10px event-edge magnet. The committed overlay dims the swimlanes **outside** the measured span with a dark fade and draws a **gray** border at each **true** selection edge that falls inside the current view (9px hit pad, 1px stem; hover/active 2px; `col-resize`; canvas z-index under Card strips). Additionally, **2px** blue bars (`measure-edge-exact`) paint on every visible event edge whose time exactly equals a range bound (above gray borders, under Card strips); they are refreshed with each `setView` so Δt-focus / zoom animation keeps them aligned with events. An edge that is only clamped onto the view boundary is **not** drawn as a border (avoids a false “selection ends here” cue). Dragging a border resizes that edge (other fixed, view-clamped, ~1px min span) without starting a new create-drag; move/up are bound on `window` so release over Card strips still ends the resize. Hovering a border **sticks** the swim/`cursor` emit to that edge (canvas `pointerleave` does not clear when moving onto the border); **wheel** on the border is forwarded so Ctrl+zoom still works around that edge time. Fades **clamp to the current view window**; when the range is fully outside the view, fades dim the entire swimlane (no bright band) and gray borders stay hidden. Preview stems are suppressed while creating or resizing. The blue Δt arrow and blue vertical bars live on the viewport time axis (see `TimelineView.spec.md`). The mouse-follow cursor is owned by `SwimlaneView` under Card strips. Aside sync is out of scope until Q22. `pointerleave` must not clear the measure anchor while a measure press/drag is active (pointer capture may keep delivering move/up outside the element). External cancel (`measureMode` false / `measureRange` null via Esc or toolbar) clears local drag/anchor immediately; a `measurePressActive` flag suppresses pan and select until `pointerup`.

**Reactivity.** A deep watcher on the viewport prop calls `renderer.setView()` and `renderer.render()` on every change. Model changes call `renderer.setModel()`. Selection/hover/`dependencyMode`/`dependencyDepth` changes trigger render only (layout unchanged; no page reload).

## Acceptance Criteria

1. **PR-CANVAS-001** — Creates canvas element and 2D context.
2. **PR-CANVAS-002** — Canvas persists after model change.
3. **PR-CANVAS-003** — In measureMode, drag (>4px) emits measureRange; pan is not emitted; pointerdown alone does not emit a range.
4. **PR-CANVAS-004** — Measure overlay shows fade and gray borders when measureRange is set.
5. **PR-CANVAS-005** — `pointerleave` during an active measure drag does not abort the drag or allow select.
6. **PR-CANVAS-006** — Clearing measureMode/measureRange mid-drag does not pan or select on subsequent move/up.
7. **PR-CANVAS-007** — Zero-length measure range (`start === end`) renders no fade/border overlay.
8. **PR-CANVAS-008** — Measure fades clamp to the view; gray borders are omitted for edges outside the view (partial or both sides).
9. **PR-CANVAS-009** — When the range is fully outside the view, measure fades dim the full swimlane; gray borders stay hidden.
10. **PR-CANVAS-010** — Dragging a measure border resizes that edge (other edge fixed); borders use a 9px hit pad, `col-resize`, and 2px stem on hover.
11. **PR-CANVAS-011** — Hovering a measure border emits `cursor` stuck to that edge (does not hide the timestamp).
12. **PR-CANVAS-012** — In measureMode, hovering an event shows gray preview borders at its start/end (no fades); leaving clears them.
13. **PR-CANVAS-013** — In measureMode, click (≤4px) on an event snaps measureRange to its borders and does not emit `select`; click on empty space clears measureRange.
14. **PR-CANVAS-014** — Clicking an event while a prior measure range exists tweens `update:measureRange` from the old span to the event borders (~180ms; instant with reduced motion).
15. **PR-CANVAS-015** — Empty-space click with a prior range expands `measureRange` to the visible view window then emits `null` (~180ms; instant with reduced motion).
16. **PR-CANVAS-016** — Clicking an event with no prior range tweens from the visible view window down to the event borders (~180ms; instant with reduced motion).
17. **PR-CANVAS-017** — Appear/clear (view↔range) tweens emit `suppress-measure-dt` true then false; range-to-range tweens do not suppress Δt.
18. **PR-CANVAS-018** — Within ~10px of an in-lane event start/end, `cursor` snaps to that edge and `measure-edge-snap` is shown (even when measureMode is off); that event is emitted as `hover`, and a click selects it.
19. **PR-CANVAS-019** — Outside the magnet threshold, `cursor` uses free `timeAtX` and no snap stem is shown.
20. **PR-CANVAS-020** — Freeform measure create/resize uses the magnet for the moving edge.
21. **PR-CANVAS-021** — Non-empty `measureRange` paints **2px** blue `measure-edge-exact` marks on all visible event edges that exactly equal a range bound (above gray borders); marks reposition whenever the view window changes (incl. Δt focus animation).
22. **PR-CANVAS-022** — Ctrl/Cmd+wheel near a magnetized event edge emits `zoom` with that edge’s time (not free `timeAtX` at the pointer).
23. **PR-CANVAS-023** — Ctrl/Cmd+wheel on a measure border emits `zoom` with that border’s stuck edge time.

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
- **2026-08-21** — Ctrl+wheel zooms on magnet / measure-border stuck time; border wheel forward; PR-CANVAS-022/023.
- **2026-08-23** — Committed exact-match edge marks are 2px (`measure-edge-exact`); live snap stem stays 1px.
- **2026-08-21** — Event-edge magnet (~10px) + committed exact-match blue marks; PR-CANVAS-018–021.
- **2026-08-20** — Hide axis Δt during view↔range appear/clear tweens; PR-CANVAS-017.
- **2026-08-20** — First event-click snap shrinks from the visible window; PR-CANVAS-016.
- **2026-08-20** — Empty click expands measure range to the view then clears; PR-CANVAS-015.
- **2026-08-20** — Animate measure borders when event-click snaps from a prior range; PR-CANVAS-014.
- **2026-08-20** — Empty measure-mode swimlane click clears measureRange; PR-CANVAS-013.
- **2026-08-20** — Measure-mode event hover preview + click-to-range; deferred create until >4px; PR-CANVAS-012/013.
- **2026-08-20** — Omit gray borders for clamped/clipped edges; PR-CANVAS-008.
- **2026-08-20** — Hover measure border sticks cursor; PR-CANVAS-011.
- **2026-08-20** — Draggable swimlane measure borders; PR-CANVAS-010.
- **2026-08-20** — Clamp measure overlay to view window; PR-CANVAS-008/009.
- **2026-08-19** — Zero-length measure range skips overlay; PR-CANVAS-007.
- **2026-08-20** — Swim cursor under Card strips; wheel forwarded from strips.
- **2026-08-13** — Measure borders under Card strips; swim cursor owned by SwimlaneView.
- **2026-08-12** — Measure overlay corrected to match sketch: fade outside, gray borders, double-sided arrow.
- **2026-08-10** — Flush paint after canvas resize (no blink on panel drag); draw surface = viewport height.
- **2026-08-07** — External measure cancel clears local drag; PR-CANVAS-006.
- **2026-08-07** — Measure drag survives pointerleave; PR-CANVAS-005.
- **2026-08-07** — Note M2 measure as planned; no AC until coded.
- **2026-08-05** — Initial spec. Core behaviors established.
