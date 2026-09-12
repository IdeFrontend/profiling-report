# Interactions

Interaction specification for the Timeline view. Sketch references are under `docs/ui/`.

For usage scenarios and how views coordinate, see **[UX_SPEC.md](UX_SPEC.md)**.

## Navigation

| Input | Behavior | Phase |
|-------|----------|-------|
| Mouse wheel over swimlane | Vertical scroll of lanes | MVP |
| Ctrl/Cmd + wheel | Zoom time axis around cursor | MVP |
| **Shift + wheel**, two-finger horizontal trackpad scroll | Pan time | MVP |
| Drag on time axis | Measure mode: create range (no pan) | MVP |
| Zoom slider / + / − | Zoom | MVP |
| Zoom to fit | Fit full `[minTime, maxTime]` in view (animated, same easing as Δt focus) | MVP |
| `W` / `S` | Zoom in / out around the cursor (viewport center when no cursor) | M3 |
| `A` / `D` | Pan left / right by a fixed 30 px step | M3 |
| Ctrl/Cmd + left-drag | Horizontal pan | M3 |
| Click lane header expand/collapse | Toggle children | MVP |

**MVP gestures:** wheel scroll, Ctrl/Cmd+wheel zoom, Shift+wheel / trackpad horizontal pan, toolbar zoom / zoom-to-fit (table above). Drag on the **swimlane** is multi-select, not pan (see [Multi-select](#multi-select)). PyPTO keyboard shortcuts (W/S zoom, A/D pan) are [UI-41](../context/decisions/UI.md#ui-41-was-q19) — do not treat them as MVP parity.

**CSS cursors (timeline):** swimlane canvas empty space uses `default` (arrow; not `crosshair` or hand `pointer`). Hovering an event uses `pointer`. Viewport time axis uses `pointer`. Measure mode / measure edge bars use `col-resize`. Overview brush uses `grab` / `grabbing` / `ew-resize` on handles.

## Hover

Sketch: `source/v930/task-hover.jpeg`

- Hovering an event shows a tooltip: **name**, **start**, **duration**, **end**. Times use **per-value** auto units (`formatDisplayTimeAuto` / `formatTimeAuto`, 4 significant digits) — independent of viewport zoom ([UI-40](../context/decisions/UI.md)). Optional **CPU clocks** on tooltip/detail are derived per [UI-45](../context/decisions/UI.md). No host `timeUnit` prop.
- Highlight the hovered rectangle by **lifting its own fill**, not by outlining it: `eventFill()` derives every state from the lane's base colour in OKLCH (`hover` and `selected` both `L+0.33`, with `selected` also `C×1.05`). Ringing on hover as well as selection is what made the two read as one state — the defect AC-08 reported — so the ring is selection's alone and rides over its fill. A block that is both keeps the selected fill. Both lifts clear the `L 0.6` label flip, so **a label inverts as the pointer crosses it**. A hovered block keeps full opacity under a selection — without that, dark text on a light fill washed by the selection dim is unreadable.
- The two compose: a hovered selected event shows the lifted fill *and* the ring.
- No selection change on hover alone.
- **Multi-row (overlapping) leaf lanes:** when a leaf grows to several sub-rows under one title, **hover, click hit-test, the event-edge magnet, and the default-mode gap measure all resolve within the sub-row under the pointer** — they do not cross into a sibling sub-row of the same leaf.
- **Default-mode gap measure:** hovering the **free middle** between two adjacent events on a lane (outside the ~10px event-edge magnet zone when the gap is wide enough, not over a block) may show a transient, non-interactive Δt overlay — two blue border sticks plus the shared double-sided Δt arrow/label — **only when the label and arrow fit entirely inside the visible gap span**. The overlay **persists during zoom/pan/scroll** while the pointer stays over the canvas, and **stays visible through a pending marquee/click press** (≤4px — visually a no-op). It is **cleared once an unmodified drag crosses the 4px gate** and the live marquee owns the gesture (Ctrl/Cmd pan still freezes gap + event hover for the drag). When both neighbouring events are off-screen but the gap still spans the window, sticks are omitted and the arrow spans the viewport (Δt shows the true gap duration). At high zoom, when the gap is narrower than ~20px, the magnet band shrinks so a fit check can still succeed. If the label does not fit, nothing is drawn. It does not capture the pointer, change selection or the time window, and is hidden in measure mode.

- **Default-mode Alt event measure:** **Alt+click** an event to set an ephemeral anchor. This **does not** select the event, open details, or change any other view — it only moves the playhead (the normal click cue). The anchored event is marked with a non-interactive white rounded border highlight (`rgba(255,255,255)`, 2px) for the whole time the anchor is set. While **Alt remains held** and the measure is not yet pinned, the target is picked by a three-step rule: **(1)** hovering another event measures to its nearest edge chosen by relation — `target.start` when the target follows the anchor, `target.end` when it precedes — and the target event is highlighted with a blue rounded border; **(2)** sticking the cursor to an event border (the ~10px edge magnet) measures to that exact border, letting the user pick a specific start or end; **(3)** otherwise the target is the free cursor, drawn as a full-height blue vertical line on every shared surface (strip and body); the anchor stick and Δt stay only on the surface that owns the anchor. Δt is always the distance from the anchor's nearest edge to the target (`target − anchor.end` when the target is later, `anchor.start − target` when earlier). Same-lane and cross-lane measurement both reuse border sticks + `MeasureDtArrow` (cross-lane adds a vertical blue dashed connector with the Δt label/arrow on the earlier event's lane). Any `deltaNs > 0` shows the overlay; when the visible span is too narrow for an inline label, the outside/shaft label fallback is used — the overlay is not hidden for fit alone. Hovering the anchor event itself, a target inside the anchor's time span, or touching (Δt = 0) show nothing (anchor highlight only). **Alt+click a different (target) event pins** the measurement when `deltaNs > 0`: the overlay and both event highlights stay after Alt release; while pinned both highlights use the same white border (no blue target style), and hover no longer updates the target. Touching (Δt = 0) Alt+click does not pin. Ephemeral **Alt+click on the same anchor** is a no-op. While pinned, **Alt+click any event** (including the anchor) sets that event as a new ephemeral anchor and drops the pin. Clearing ephemeral: **Alt keyup**, **pointermove with Alt released** (covers missed keyup after Alt+Tab/blur), **Esc**, Alt+click empty space, **collapsing a Card/folder**, or **pinning/unpinning any lane**. Clearing pinned: **Esc**, empty-canvas click (with or without Alt), any non-Alt click (including selecting an event), any visible-range change (pan/zoom/scroll), entering measure mode, **collapsing a Card/folder**, or **pinning/unpinning any lane**. While a session is active, the default hover-gap measure is suppressed (including during pan). Alt-retargeting does **not** clear event hover / tooltip. Hidden in measure mode. When a sticky pinned-lane strip is present, the Alt-measure session is shared across the strip and body canvases; each endpoint records which surface captured it so chrome follows the clicked instance (a body Alt+click on a pinned lane stays on the body row). Crossing strip↔body does **not** clear the ephemeral target on `pointerleave` of either canvas. With no sticky strip, the scroll canvas uses the `solo` role so leave clears live preview. Cross-surface pairs can measure between sticky and scroll-body events; the parent dashed vertical bridge stays when either edge is outside the current time window.

**MVP:** required.

## Single selection

Sketches: [`v930/task-click-detail`](./source/v930/task-click-detail.jpeg) (click → 详情 + 置灰), [`v930/detail-strip-raised`](./source/v930/detail-strip-raised.jpeg)

- Click event → selected state, a 2px white ring. Distinct from hover, which lifts the fill instead.
- Populate detail region with at least name and start → duration (and end).
- Optional: dim non-selected events slightly (shown in `task-click-detail`).
- Click empty space → clear selection.

**MVP:** required. Full bottom dock with source paths and dependency graph → Phase 2.

## Multi-select

Sketch: [`v930/task-marquee`](./source/v930/task-marquee.jpeg)

- **Unmodified drag on the swimlane** (>4px) draws a marquee rectangle and selects every leaf event whose block intersects it. This is the default gesture — that press does **not** pan; pan moved to Shift+wheel / trackpad horizontal scroll. Below 4px the press is still a click-to-select.
- **Pending press (≤4px):** visually a no-op until the gate is crossed — lane-row / gutter hover highlight and the default-mode hover-gap Δt overlay stay as they were under the pointer. Do not clear them on `pointerdown` (that flashed the header and gap arrow on every click).
- **Live marquee (>4px):** hide lane-row hover and the hover-gap overlay; show only the blue marquee rect plus the unsnapped vertical cursor / timestamp bar that follows the pointer. Axis Δt chrome follows the marquee's time extent. The bottom dock updates live from coverage: **1 event → DetailPanel**, **≥2 → MultiSelectSummary**. Host selection / viewState commit only on release.
- **Measure mode wins:** while the caliper is on, an unmodified drag creates / resizes `measureRange` and never marquees.
- Marquee commit replaces any single selection (and vice versa); an empty rect clears both. A rect that covers **exactly one** event is treated as a normal single selection (DetailPanel), not the multi-select summary. Escape cancels mid-drag (restores the pre-drag dock; no host `select`) and clears a committed selection.
- Mode switches (single↔multi, including live preview) cross-fade **dock content only**; the footer shell height stays stable.
- **Δt chrome:** the viewport time axis shows the same measure UI (blue edge bars + double-sided Δt arrow + duration) over the marquee's time extent while dragging. The Δt chrome is cleared on commit; the committed selection no longer draws a hull span. Same geometry as measure — not a second style.
- Selected events keep full opacity; the rest use the same solid `#2C2C2C` mute as single-click selection.
- Summary table: count header + per-event Slices table ([MultiSelectSummary](../../src/ui/MultiSelectSummary/MultiSelectSummary.spec.md)).
- Additive **Shift+click** toggles a single event in/out of the selection; the marquee remains the bulk multi-select gesture.
- Additive **Shift+drag** unions the new marquee rectangle with the existing single and multi selections; the committed selection keeps every selected id exactly once.

**Phase 2 — implemented.**

## Pin lane (gutter pushpin)

Sketch: [`v930/hardware-more-detail`](./source/v930/hardware-more-detail.jpeg) (Core2.Cube expanded gutter)

**Product (2026-09-04) — [UI-44](../context/questions/deferred.md):** folder/group pin is **deferred** out of the current iteration. Shipped behavior remains **leaf lanes only**. Folder + subtree strip is parked on `feat/pin-grouping-nodes` (PR [#69](https://github.com/IdeFrontend/profiling-report/pull/69) closed unmerged).

- **Leaf lanes only:** unpinned pushpin appears on **gutter row hover** only (not when hovering the events chart); **pinned pushpin stays visible** on the original row and sticky-strip duplicate. Flush to the **left edge** of the gutter (not depth-indented). Outline `#a8a8a8` unpinned; solid `#4a90e2` when pinned or when hovering the pin. Full gutter row highlight `#252525` on gutter hover **or** when the pointer is over that leaf’s events-chart band (header hint only — no highlight painted on the swimlane itself). Tooltip **置顶**.
- Click unpinned pushpin → parent appends lane id to **pinnedLaneIds**; click pinned → remove. Context-menu **Pin row** (Ctrl+P) toggles the same **pinnedLaneIds** — one pin state, two affordances.
- **Sticky strip:** pinned leaf rows duplicate at the top of the swim body (gutter + canvas); originals remain in tree order below. Strip stays when an ancestor Card/folder is collapsed (pins are built from the full swim model). Strip shows **events only** — no dependency beziers. Pins may span multiple Cards/groups; strip order = pin order. See [`LaneGutter.spec.md`](../../src/ui/TimelineView/SwimlaneView/LaneGutter/LaneGutter.spec.md), [`SwimlaneView.spec.md`](../../src/ui/TimelineView/SwimlaneView/SwimlaneView.spec.md).
- **Overview / summary charts (PyPTO counter pin):** each 统计分析 track has the same pushpin affordance. Click appends the series id to **pinnedOverviewIds**. Sticky duplicates sit **above** the pinned-lane strip and **above** the scrolling swim body; the unpinned 统计分析 block scrolls with the lanes. Unpin from either the section or the sticky strip. Shared playhead line paints over overview tracks; hover shows the step value (EventTooltip chrome).
**Phase 2+** (spec + crops landed; implementation follows).

**Deferred ([UI-47](../context/questions/deferred.md)):** sketch mid-row bar-chart / **统计** between lane title and util bar — do not ship this iteration (distinct from pin, 报告 aside, and Card 时钟周期).

## Context menu

Sketch: [`v930/task-context-menu`](./source/v930/task-context-menu.jpeg)

- Right-click lane or event → menu (e.g. **Pin row** + Ctrl+P, copy name, reveal in details). **Pin row** writes the same **pinnedLaneIds** as the gutter pushpin; gutter icon is the primary affordance in this pass.

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

- Toolbar **caliper** toggles `measureMode`. While active, the swimlane drag creates a measure range instead of a marquee (zoom/wheel still allowed unless Product says otherwise).
- Drag on the swimlane (or time axis) sets `measureRange: { startUs, endUs }` (order-normalized). On the swimlane, create starts only after move >4px; a click (≤4px) over an event snaps the range to that event’s borders and selects the event. Borders animate from a prior range when one exists, otherwise shrink in from the visible window; empty swimlane click expands the range to the visible window then clears it and clears the event selection. During appear/clear (view↔range) tweens, hide the axis Δt arrow and duration label (borders + fades still animate); keep Δt chrome when tweening between two non-empty ranges.
- **Event-edge magnet (always on swimlane):** within ~10px of the nearest start/end on the **sub-row** (or single-row leaf) under the pointer, the cursor (and freeform create/resize edges) snap to that time; a short blue stem highlights the snapped event edge. That event is treated as hovered (tooltip) and is selectable on click even when the pointer is slightly outside the block. Outside the threshold the pointer stays free. The time axis does not magnetize. **Magnet follows the canvas under the pointer** across the pinned strip and the main swimlane (create/resize may start on one and snap-finish on the other). **Ctrl/Cmd+wheel** zooms around the stuck timestamp (magnet or measure-border stick), preserving the pointer↔edge pixel gap so zooming out restores the prior window. Wheel over swimlane measure borders is forwarded (borders no longer swallow zoom).
- **Committed event-edge marks:** when a non-empty `measureRange` is set, short blue bars appear on every visible event whose start or end **exactly equals** either range bound (shared timestamps highlight all matches; accidental free-drag equality still highlights). Full-height gray swimlane borders are unchanged. Origins are not stored on the range.
- Hovering an event in measure mode shows gray preview stems at the event edges (no fades; non-interactive).
- Overlay: translucent shaded band spanning the interval + floating **Δt** label using **per-value** auto units (e.g. `3.000 ms` or `50 ns` from the gap magnitude, not viewport zoom).
- **Focus:** clicking the Δt pill animates the viewport so the measured range is centered and spans half the visible width (~400ms ease-out; instant with reduced motion).
- Axis **cursor timestamp** lifts above the viewport time axis when the pointer is over that axis (so ticks stay readable), when its pill overlaps the measured range (including when the playhead is just outside a border but the pill still crosses it), or when it covers an outside / offscreen Δt label, with a short animated transition; otherwise (swimlane hover, clear of measure chrome) it stays in-track. Axis hover also keeps the **full-height swimlane playhead** at the same x.
- **Clipped / offscreen edges:** do not draw a bar or arrowhead for a measure edge that lies outside the current view (avoids a false “selection ends at the screen edge” cue). When the whole range is off-screen, the time axis keeps a one-sided near-edge cue (pointing chevron + Δt; no vertical edge bar); swimlane fades dim the full lane and gray borders stay hidden.
- **Edge resize:** left/right measure bars (axis blue + swimlane gray) are draggable when that true edge is in view. Hover uses `col-resize` and thickens the stem to 2px; drag moves that edge with a ~1px min span and clamps the **dragged** edge into the current view (the other edge stays fixed even if off-screen). Empty-axis / empty-swimlane drag still creates a new range. Hovering a measure edge **sticks** the cursor timestamp to that border (does not hide it); the pill lifts above when it overlaps the bar.
- Does **not** change `timeWindow` (unlike overview brush). Does **not** multi-select events — marquee multi-select is the separate gesture above, and measure mode suppresses it.
- Clear: toggle off, Esc, or clear control — clears `measureRange` and exits measure mode.
- **M2 minimum:** create range + clear + band + Δt label + edge resize.
- **Aside / other-view sync:** Measure does **not** recompute the right panel or other views. Local overlay only (shaded band + Δt). Cards, PIPE, details, memory diagram, Roofline, detail strip, and overview stay unchanged. Distinct from overview brush (`timeWindow`) and event selection.

## Right panel coordination

- Aside **close** clears `asideVisible` (equivalent to toolbar stats toggle off). See [StatsAside.spec.md](../../src/ui/StatsAside/StatsAside.spec.md).
- **更多** / More opens interim `HardwareDetailsPanel` (DATA-34a) when data exists and emits `open-hardware-details`.
- Stacked 报告统计 (M2): summary cards (duration + compute/util `N/A` placeholders + I/O BW), roofline, PIPE, topology — no mode-tab switcher. PIPE **详情** opens compute CSV overlay; topology **详情** and stacked-diagram **right-click** (UI-35) open memory CSV overlay; topology **全屏** (fit-window icon) covers `.pr-root` with the current diagram and a Back control (not the browser Fullscreen API); overlay right-click does not open the memory CSV overlay; Escape closes the overlay (after measure-clear); W/S/A/D do not pan/zoom the covered timeline. Aside overlay back returns to the stack.
- PIPE bars default to mean aggregates ([DATA-33b](../context/decisions/interim/DATA.md)); when `PipeUtilization.csv` has >1 block, summary **block** control (All \| id) scopes PIPE (PR-STATS-014b). Measure range does not change them.
- Detail / memory lists are **block-scoped** via block switcher ([DATA-33c](../context/decisions/interim/DATA.md)); topology labels use the same `selectedBlockId` (synced when the summary block control picks an id; **All** restores the default topology block).
- Cube \| Vector toggle on PIPE for MIX ops only.
- PIPE section **详情** navigates to compute CSV overlay + emits `open-pipe-details`.
- Roofline (M2 interim DATA-37*): shown on the stack after the duration card when `report.roofline.points` non-empty; tabs omitted.
- Compute details overlay: tabs PipeUtilization | ArithmeticUtilization | ResourceConflictRatio.
- Memory details overlay: tabs Memory L1 | L2Cache | Memory L0 | Memory UB; **查看全部** opens full CSV ([DATA-33d](../context/decisions/interim/DATA.md)).
- Selecting a lane or event may filter lists later (still open); do not invent until Product confirms.

## Accessibility and robustness

- Tooltips must not block pan/zoom hit-testing incorrectly (dismiss on pan start).
- Large traces: hit-testing must use spatial index or GPU pick buffer when WebGL renderer is adopted (see [SWIMLANE_IMPLEMENTATIONS.md](../archive/research/SWIMLANE_IMPLEMENTATIONS.md)).
- Measure overlay must not steal hits when `measureMode` is false.