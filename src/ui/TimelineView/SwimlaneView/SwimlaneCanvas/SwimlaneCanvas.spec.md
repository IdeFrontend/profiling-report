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

**Canvas lifecycle.** On mount the renderer attaches but backing stores stay **0×0** until `ResizeObserver` delivers a size — no HTML default 300×150 and no speculative `css × devicePixelRatio` buffer. Observe the **main** canvas with `{ box: 'device-pixel-content-box' }`; on each callback read `devicePixelContentBoxSize` (`inlineSize` / `blockSize`) and call `resize(deviceW, deviceH, window.devicePixelRatio)` on each active renderer. `.pr-swim-canvas` CSS is constant `position: absolute; left/top: 0; width/height: 100%` of the wrap — JS never sets `canvas.style` width/height. If the entry lacks `devicePixelContentBoxSize`, derive from `contentBoxSize × dpr` in that same RO callback only. Paint is skipped until a positive device box has been received. After a buffer resize (which clears pixels), paint runs in the same turn — not deferred to the next animation frame — so gutter/aside drag does not flash a blank swimlane.

**Track width.** `cursor` `xRatio` and `time` derive from CSS wrap `clientWidth` / bounding rect. Hit-testing uses device pixels: `hitTest(localX * dpr, localY * dpr)`.

**Scroll model.** The container uses `overflow: hidden` with a synthetic scroll mechanism: a sizer div sets the total content height, and `localScrollY` tracks the actual scroll offset. The drawing surface is sized to the **visible viewport** only; lanes are scrolled via `scrollY` in the renderer.

**Pointer translation.** `pointerdown` records the starting position. `pointermove` performs hitTest (**device-pixel** coords = CSS local × `dpr`) and emits `hover` (with clientX/clientY for tooltip positioning) and `cursor` (time + xRatio + `snapped` for playhead). The swimlane cursor **always** magnetizes to the nearest in-lane event start/end within ~10px CSS (leaf lane under the pointer); outside that threshold it uses linear `timeAtX` (CSS). While magnetized, 2px blue bars (`measure-edge-snap`) paint on **every** visible event edge whose time exactly equals the snapped time (same projection as the committed `measure-edge-exact` marks), the `cursor` emit carries `snapped: true` (graying the full-height swim/axis line), and the magnetized event is treated as hovered (tooltip / highlight) and is selected on click even when the pointer is slightly outside the block. **Ctrl/Cmd+wheel** zooms around the stuck timestamp (magnetized event edge, or hovered measure-border time), so the edge stays at its screen X and the pointer↔edge gap is preserved. While dragging **and not in measureMode**, every move emits `pan` in time units. On `pointerup`, if total movement <=4px and not measuring, `hitTest` (or the magnetized event) is emitted as `select`.

**Measure mode (M2).** When `measureMode` is true, pan and `select` are suppressed — except a measure-mode click still updates selection: clicking an event selects it, clicking empty space clears the selection. **Hover** over an event shows two non-interactive **gray** full-height preview stems at the event’s true `startTime` / `endTime` (omit an edge outside the view; no fades). **Click** (move ≤4px) over an event snaps `measureRange` to that event’s borders via `update:measureRange` and emits `select` for that event. Borders tween (~180ms ease; instant with reduced motion): from a prior range when one exists, otherwise shrink from the visible view window. Click on empty space clears the range and the selection: borders expand to the visible view window (~180ms), then `measureRange` becomes `null` (instant clear when reduced motion or when the range already spans the view). During appear/clear (view↔range) tweens, emit `suppress-measure-dt` so the axis Δt arrow/label stay hidden; range-to-range tweens keep Δt visible. **Drag** (move >4px) starts freeform create (anchor at pointerdown X, magnetized); `pointerdown` does **not** emit a range until the threshold is crossed. The moving create/resize edge uses the same 10px event-edge magnet. The committed overlay dims the swimlanes **outside** the measured span with a dark fade and draws a **gray** border at each **true** selection edge that falls inside the current view (9px hit pad, 1px stem; hover/active 2px; `col-resize`; canvas z-index under Card strips). Additionally, **2px** blue bars (`measure-edge-exact`) paint on every visible event edge whose time exactly equals a range bound (above gray borders and the swim playhead stem, under Card strips); they are refreshed with each `setView` so Δt-focus / zoom animation keeps them aligned with events. While a freeform create drag is active, the fixed **anchor** (start) border keeps its 2px blue `measure-edge-exact` marker (the moving edge is a float and is not marked until it settles). An edge that is only clamped onto the view boundary is **not** drawn as a border (avoids a false “selection ends here” cue). Dragging a border resizes that edge (other fixed, view-clamped, ~1px min span) without starting a new create-drag; move/up are bound on `window` so release over Card strips still ends the resize. Hovering a border **sticks** the swim/`cursor` emit to that edge (canvas `pointerleave` does not clear when moving onto the border); **wheel** on the border is forwarded so Ctrl+zoom still works around that edge time. Fades **clamp to the current view window**; when the range is fully outside the view, fades dim the entire swimlane (no bright band) and gray borders stay hidden. Preview stems are suppressed while creating or resizing. The blue Δt arrow and blue vertical bars live on the viewport time axis (see `TimelineView.spec.md`). The mouse-follow swim cursor bar is rendered inside the canvas wrap (`cursorXRatio` / `cursorSnapped` props from `SwimlaneView`) at `z-index: 3`, below blue edge marks. Aside does not recompute for `measureRange` (local overlay only). `pointerleave` must not clear the measure anchor while a measure press/drag is active (pointer capture may keep delivering move/up outside the element). External cancel (`measureMode` false / `measureRange` null via Esc or toolbar) clears local drag/anchor immediately; a `measurePressActive` flag suppresses pan and select until `pointerup`.

**Hover gap measure (default mode).** When `measureMode` is false and the pointer sits in the **free middle** of a gap between two adjacent events on a leaf lane — within the event block vertical band (not the lane padding above/below blocks), outside the ~10px event-edge magnet band when the gap is wide enough (~20px+), not over any event block — `SwimlaneCanvas` may render a non-interactive `gap-measure` overlay: two blue border sticks at the neighbouring edges plus the shared `MeasureDtArrow` Δt label showing `rightStart − leftEnd`, **only when the label and double arrow fit entirely inside the visible gap span** (inline layout; no outside/shaft fallback). When the gap is narrower than ~20px (common at high zoom), the magnet band shrinks so a fit check can still succeed in the middle. If the Δt label does not fit within the visible span, the overlay is omitted entirely. When both neighbouring events fall outside the view but the gap still spans the window, sticks are hidden and the arrow spans the full viewport width (Δt still shows the true gap duration). The overlay persists across **zoom / pan / scroll** while the pointer remains over the canvas — including during left-button pan drag: the view-window watcher **recomputes** (not clears) the gap from the last pointer position and `gapMeasureGeometry` re-projects sticks/Δt. **Pan capture:** on `pointerdown` the active hover gap and event hover are **frozen** (pointer capture) until `pointerup`; vertical lane changes during pan do not move the gap overlay, and `hover` emits keep the captured event. It hides when the entire gap is outside the view or the label no longer fits inline. The overlay is `pointer-events: none`, cleared on `pointerleave` (except during an active pan capture), and recomputed when the view window or scroll changes.

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
13. **PR-CANVAS-013** — In measureMode, click (≤4px) on an event snaps measureRange to its borders and emits `select` for that event; click on empty space clears measureRange and clears the selection.
14. **PR-CANVAS-014** — Clicking an event while a prior measure range exists tweens `update:measureRange` from the old span to the event borders (~180ms; instant with reduced motion).
15. **PR-CANVAS-015** — Empty-space click with a prior range expands `measureRange` to the visible view window then emits `null` (~180ms; instant with reduced motion).
16. **PR-CANVAS-016** — Clicking an event with no prior range tweens from the visible view window down to the event borders (~180ms; instant with reduced motion).
17. **PR-CANVAS-017** — Appear/clear (view↔range) tweens emit `suppress-measure-dt` true then false; range-to-range tweens do not suppress Δt.
18. **PR-CANVAS-018** — Within ~10px of an in-lane event start/end, `cursor` snaps to that edge with `snapped: true` and `measure-edge-snap` shows a blue bar on **every** lane whose event edge exactly equals that time (even when measureMode is off); that event is emitted as `hover`, and a click selects it.
19. **PR-CANVAS-019** — Outside the magnet threshold, `cursor` uses free `timeAtX` and no snap stem is shown.
20. **PR-CANVAS-020** — Freeform measure create/resize uses the magnet for the moving edge.
21. **PR-CANVAS-021** — Non-empty `measureRange` paints **2px** blue `measure-edge-exact` marks on all visible event edges that exactly equal a range bound (above gray borders); marks reposition whenever the view window changes (incl. Δt focus animation).
22. **PR-CANVAS-022** — Ctrl/Cmd+wheel near a magnetized event edge emits `zoom` with that edge’s time (not free `timeAtX` at the pointer).
23. **PR-CANVAS-023** — Ctrl/Cmd+wheel on a measure border emits `zoom` with that border’s stuck edge time.
24. **PR-CANVAS-024** — Cursor `xRatio` and `time` share one track width.
25. **PR-CANVAS-025** — Canvas sizes to wrap width, not HTML default 300px.
26. **PR-CANVAS-026** — Measure overlay geometry recomputes when the wrap width changes (resizeTick).
27. **PR-CANVAS-027** — In default mode (measureMode off), hovering the free middle between two adjacent events on a leaf lane renders a non-interactive gap measure overlay: two blue border sticks at the left event’s end and the right event’s start, plus a Δt arrow/label showing `formatTime(rightStart − leftEnd)`.
28. **PR-CANVAS-028** — Hovering over an event block (or its interior) renders no gap overlay (tooltip wins).
29. **PR-CANVAS-029** — Hovering within the ~10px event-edge magnet threshold of either neighbouring edge renders no gap overlay (magnet/tooltip wins); the gap shows only in the free middle.
30. **PR-CANVAS-030** — `measureMode: true` suppresses the hover gap overlay entirely.
31. **PR-CANVAS-031** — Starting a pan drag keeps the hover gap overlay; view updates during drag refresh it at the last pointer position.
32. **PR-CANVAS-032** — `pointerleave` clears the hover gap overlay (except during an active pan capture).
33. **PR-CANVAS-033** — Replacing the `view` prop without changing `startTime`/`endTime`/`scrollY` (e.g. hover-driven `hoveredEventId` updates) does not clear an active hover gap overlay.
34. **PR-CANVAS-034** — When the Δt label and arrow do not fit inline inside the gap span, no gap overlay is rendered.
35. **PR-CANVAS-035** — Zoom/pan/scroll view updates refresh the hover gap at the last pointer position; when both gap edges are off-screen but the gap spans the view, the overlay shows a full-width arrow (no sticks) until the entire gap is outside the view or the label no longer fits inline.
36. **PR-CANVAS-036** — When the entire gap falls outside the view (both edges on the same side), no gap overlay is rendered.
37. **PR-CANVAS-037** — During pan drag, the hover gap stays on the lane captured at `pointerdown` (vertical pointer movement does not retarget another lane).
38. **PR-CANVAS-038** — During pan drag, `hover` emits keep the event captured at `pointerdown` until `pointerup`.
39. **PR-CANVAS-039** — During a freeform create drag, the fixed anchor (start) border keeps its 2px blue `measure-edge-exact` marker (the moving edge is not marked until it settles).
40. **PR-CANVAS-040** — Blue `measure-edge-snap` / `measure-edge-exact` marks stack above the swim playhead stem (`.pr-swim-cursor`, `z-index: 3`).
41. **PR-CANVAS-041** — While resizing a measure border, the gray border stem hides and the full-height playhead is **blue** when the edge is not magnetized to an event (`snapped: false`); gray when magnetized.
42. **PR-CANVAS-042** — `findExactEdgeMatchesAt` is memoized per snapped time — repeated `pointermove` at the same magnet edge rescans once.
43. **PR-CANVAS-043** — Hovering a measure border on an event edge emits `snapped: true` (consistent with press).

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
- **2026-08-27** — Memoize exact-edge scans per snapped time; border hover emits `snapped`; PR-CANVAS-042/043.
- **2026-08-27** — Integrate hover-gap measure (#36) with magnet snap cursor; renumber snap ACs to PR-CANVAS-039–043.
- **2026-08-26** — Pan capture freezes hover gap lane and event hover during drag; PR-CANVAS-037/038.
- **2026-08-26** — Hover gap persists across zoom/pan/scroll (refresh at last pointer); PR-CANVAS-035.
- **2026-08-26** — Hover gap measure renders only when Δt label fits inline inside the gap; PR-CANVAS-034.
- **2026-08-26** — Fix hover gap cleared on every pointermove (view watch used a fresh tuple each evaluation); PR-CANVAS-033.
- **2026-08-26** — Narrow-gap hover measure: shrink magnet edge band when gap &lt; ~20px so Δt overlay still appears at high zoom.
- **2026-08-26** — Default-mode hover gap measure (sticks + Δt arrow between adjacent events); shared `MeasureDtArrow`; PR-CANVAS-027–032.
- **2026-08-26** — Measure-border resize drag: unsnapped edge uses blue playhead; gray border stem hidden during drag; PR-CANVAS-041.
- **2026-08-26** — Magnet snap paints multi-lane 2px blue bars at matching edges; `cursor` emits `snapped` to gray the full-height swim/axis line (PR-CANVAS-018).
- **2026-08-25** — Measure-mode event click also selects the event; empty-space click also clears the selection (PR-CANVAS-013/014/015/016).
- **2026-08-25** — `resizeTick` invalidates measure overlay geometry on width-only resize; PR-CANVAS-026.
- **2026-08-24** — Unified track width for cursor/time; size canvas from wrap; PR-CANVAS-024/025.
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
