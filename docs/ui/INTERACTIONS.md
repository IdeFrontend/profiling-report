# Interactions

Interaction specification for the Timeline view. Sketch references are under `docs/ui/`.

For usage scenarios and how views coordinate, see **[UX_SPEC.md](UX_SPEC.md)**.

## Navigation

| Input | Behavior | Phase |
|-------|----------|-------|
| Mouse wheel over swimlane | Vertical scroll of lanes | MVP |
| Ctrl/Cmd + wheel | Zoom time axis around cursor | MVP |
| Drag on time axis / empty swimlane (with modifier if needed) | Pan time | MVP |
| Zoom slider / + / − | Zoom | MVP |
| Zoom to fit | Fit full `[minTime, maxTime]` in view (animated, same easing as Δt focus) | MVP |
| Click lane header expand/collapse | Toggle children | MVP |

**MVP gestures:** wheel scroll, Ctrl/Cmd+wheel zoom, drag pan, toolbar zoom / zoom-to-fit (table above). PyPTO keyboard shortcuts (W/S zoom, A/D pan) are **Phase 2** unless [Q19](../context/OPEN_QUESTIONS.md) resolves otherwise — do not treat them as MVP parity.

## Hover

Sketch: `source/v930/task-hover.jpeg`

- Hovering an event shows a tooltip: **name**, **start**, **duration**, **end**. Times use **per-value** auto units (`formatDisplayTimeAuto` / `formatTimeAuto`, 4 significant digits) — independent of viewport zoom ([I-Q14](../context/INTERIM_DECISIONS.md)). No host `timeUnit` prop.
- Highlight the hovered rectangle (outline or brightness).
- No selection change on hover alone.
- **Default-mode gap measure:** hovering the **free middle** between two adjacent events on a lane (outside the ~10px event-edge magnet zone when the gap is wide enough, not over a block) may show a transient, non-interactive Δt overlay — two blue border sticks plus the shared double-sided Δt arrow/label — **only when the label and arrow fit entirely inside the visible gap span**. The overlay **persists during zoom/pan/scroll and left-button pan drag** while the pointer stays over the canvas. When both neighbouring events are off-screen but the gap still spans the window, sticks are omitted and the arrow spans the viewport (Δt shows the true gap duration). **Pan capture:** on button down, the active gap measure and event hover **freeze** until button up — lane and hovered event do not change while dragging. At high zoom, when the gap is narrower than ~20px, the magnet band shrinks so a fit check can still succeed. If the label does not fit, nothing is drawn. It does not capture the pointer, change selection or the time window, and is hidden in measure mode.

**MVP:** required.

## Single selection

Sketches: [`v930/task-click-detail`](./source/v930/task-click-detail.jpeg) (click → 详情 + 置灰), [`v930/detail-strip-raised`](./source/v930/detail-strip-raised.jpeg)

- Click event → selected state (distinct from hover).
- Populate detail region with at least name and start → duration (and end).
- Optional: dim non-selected events slightly (shown in `task-click-detail`).
- Click empty space → clear selection.

**MVP:** required. Full bottom dock with source paths and dependency graph → Phase 2.

## Multi-select

Sketch: `source/v930/entry.jpeg`

- Additive selection (Shift/Ctrl click or rubber-band) of multiple events or a time range.
- Summary table: aggregate count, total duration, per-op breakdown.

**Phase 2+.**

## Context menu

Sketch: `source/v930/entry.jpeg`

- Right-click lane or event → menu (e.g. **Pin row**, copy name, reveal in details).

**Phase 2+.**

## Dependencies

Sketch: [`v930/task-click-detail`](./source/v930/task-click-detail.jpeg) (swimlane beziers + Relevant toolbar callout)

- Optional curved links between predecessor/successor events, drawn by `WebGlSwimlaneRenderer` / `CanvasSwimlaneRenderer` ([DependencyLinksLayer spec](../../src/ui/TimelineView/SwimlaneView/DependencyLinksLayer/DependencyLinksLayer.spec.md)).
- Display control (mode + hop depth) filters which curves are drawn.
- Detail panel Relevant column: incoming / current / outgoing graph with depth filters. The three toolbar icons (left → right) mean: **forward-only**, **forward+backward**, **backward-only** (design callout on `task-click-detail`).
- **Task Connection Level** numeric filter (sketch shows `-1`).

**Phase 2+** — requires dependency data in trace args or side tables. Sample `out.rep` has no deps.

## Playhead / scrubbing

- Vertical line at current time; label with timestamp.
- Click/drag on ruler to move playhead (optional sync with overview charts).

**MVP:** show playhead tied to view center or last click; full scrub UX polish can follow.

## Search

- Query filters or highlights matching event names.
- Enter / next / previous jump to matches (Phase 2 polish; MVP may highlight only).

**MVP:** basic substring filter or highlight.

## Time-range measure (度量模式)

Sketch: [`v930/task-measure-mode`](./source/v930/task-measure-mode.jpeg). Delivery: **M2**.

- Toolbar **caliper** toggles `measureMode`. While active, pan-drag on the swimlane is disabled (zoom/wheel still allowed unless Product says otherwise).
- Drag on the swimlane (or time axis) sets `measureRange: { startUs, endUs }` (order-normalized). On the swimlane, create starts only after move >4px; a click (≤4px) over an event snaps the range to that event’s borders and selects the event. Borders animate from a prior range when one exists, otherwise shrink in from the visible window; empty swimlane click expands the range to the visible window then clears it and clears the event selection. During appear/clear (view↔range) tweens, hide the axis Δt arrow and duration label (borders + fades still animate); keep Δt chrome when tweening between two non-empty ranges.
- **Event-edge magnet (always on swimlane):** within ~10px of the nearest start/end on the leaf lane under the pointer, the cursor (and freeform create/resize edges) snap to that time; a short blue stem highlights the snapped event edge. That event is treated as hovered (tooltip) and is selectable on click even when the pointer is slightly outside the block. Outside the threshold the pointer stays free. The time axis does not magnetize. **Ctrl/Cmd+wheel** zooms around the stuck timestamp (magnet or measure-border stick), preserving the pointer↔edge pixel gap so zooming out restores the prior window. Wheel over swimlane measure borders is forwarded (borders no longer swallow zoom).
- **Committed event-edge marks:** when a non-empty `measureRange` is set, short blue bars appear on every visible event whose start or end **exactly equals** either range bound (shared timestamps highlight all matches; accidental free-drag equality still highlights). Full-height gray swimlane borders are unchanged. Origins are not stored on the range.
- Hovering an event in measure mode shows gray preview stems at the event edges (no fades; non-interactive).
- Overlay: translucent shaded band spanning the interval + floating **Δt** label using **per-value** auto units (e.g. `3.000 ms` or `50 ns` from the gap magnitude, not viewport zoom).
- **Focus:** clicking the Δt pill animates the viewport so the measured range is centered and spans half the visible width (~400ms ease-out; instant with reduced motion).
- Axis **cursor timestamp** lifts above the viewport time axis when the pointer is over that axis (so ticks stay readable), when its pill overlaps the measured range (including when the playhead is just outside a border but the pill still crosses it), or when it covers an outside / offscreen Δt label, with a short animated transition; otherwise (swimlane hover, clear of measure chrome) it stays in-track. Axis hover also keeps the **full-height swimlane playhead** at the same x.
- **Clipped / offscreen edges:** do not draw a bar or arrowhead for a measure edge that lies outside the current view (avoids a false “selection ends at the screen edge” cue). When the whole range is off-screen, the time axis keeps a one-sided near-edge cue (pointing chevron + Δt; no vertical edge bar); swimlane fades dim the full lane and gray borders stay hidden.
- **Edge resize:** left/right measure bars (axis blue + swimlane gray) are draggable when that true edge is in view. Hover uses `col-resize` and thickens the stem to 2px; drag moves that edge with a ~1px min span and clamps the **dragged** edge into the current view (the other edge stays fixed even if off-screen). Empty-axis / empty-swimlane drag still creates a new range. Hovering a measure edge **sticks** the cursor timestamp to that border (does not hide it); the pill lifts above when it overlaps the bar.
- Does **not** change `timeWindow` (unlike overview brush). Does **not** multi-select events.
- Clear: toggle off, Esc, or clear control — clears `measureRange` and exits measure mode.
- **M2 minimum:** create range + clear + band + Δt label + edge resize.
- **Aside / other-view sync:** Measure does **not** recompute the right panel or other views. Local overlay only (shaded band + Δt). Cards, PIPE, details, memory diagram, Roofline, detail strip, and overview stay unchanged. Distinct from overview brush (`timeWindow`) and event selection.

## Right panel coordination

- Aside **close** clears `asideVisible` (equivalent to toolbar stats toggle off). See [StatsAside.spec.md](../../src/ui/StatsAside/StatsAside.spec.md).
- **更多** / More opens interim `HardwareDetailsPanel` (I-Q7a) when data exists and emits `open-hardware-details`.
- Stacked 报告统计 (M2): summary cards (duration + compute/util `N/A` placeholders + I/O BW), roofline, PIPE, topology — no mode-tab switcher. PIPE **详情** opens compute CSV overlay; topology **详情** opens memory CSV overlay; back control returns to the stack.
- PIPE bars remain global mean aggregates ([I-Q6b](../context/INTERIM_DECISIONS.md)); measure range does not change them.
- Detail / memory lists are **block-scoped** via block switcher ([I-Q6c](../context/INTERIM_DECISIONS.md)); topology labels use the same `selectedBlockId`.
- Cube \| Vector toggle on PIPE for MIX ops only.
- PIPE section **详情** navigates to compute CSV overlay + emits `open-pipe-details`.
- Roofline (M2 interim I-Q11*): shown on the stack after the duration card when `report.roofline.points` non-empty; tabs omitted.
- Compute details overlay: tabs PipeUtilization | ArithmeticUtilization | ResourceConflictRatio.
- Memory details overlay: tabs Memory L1 | L2Cache | Memory L0 | Memory UB; **查看全部** opens full CSV ([I-Q6d](../context/INTERIM_DECISIONS.md)).
- Selecting a lane or event may filter lists later (still open); do not invent until Product confirms.

## Accessibility and robustness

- Tooltips must not block pan/zoom hit-testing incorrectly (dismiss on pan start).
- Large traces: hit-testing must use spatial index or GPU pick buffer when WebGL renderer is adopted (see [SWIMLANE_IMPLEMENTATIONS.md](../archive/research/SWIMLANE_IMPLEMENTATIONS.md)).
- Measure overlay must not steal hits when `measureMode` is false.