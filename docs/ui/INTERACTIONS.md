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
| Zoom to fit | Fit full `[minTime, maxTime]` in view | MVP |
| Click lane header expand/collapse | Toggle children | MVP |

**MVP gestures:** wheel scroll, Ctrl/Cmd+wheel zoom, drag pan, toolbar zoom / zoom-to-fit (table above). PyPTO keyboard shortcuts (W/S zoom, A/D pan) are **Phase 2** unless [Q19](../context/OPEN_QUESTIONS.md) resolves otherwise — do not treat them as MVP parity.

## Hover

Sketch: `source/v930/task-hover.jpeg`

- Hovering an event shows a tooltip: **name**, **start**, **duration**, **end**. Display time **unit is configurable** ([Q14](../context/OPEN_QUESTIONS.md)); default formatting uses ms-style labels unless host sets µs/ns/cycles.
- Highlight the hovered rectangle (outline or brightness).
- No selection change on hover alone.

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
- Drag on the swimlane (or time axis) sets `measureRange: { startUs, endUs }` (order-normalized).
- Overlay: translucent shaded band spanning the interval + floating **Δt** label using the current display `timeUnit` (e.g. `3.0ms`).
- Does **not** change `timeWindow` (unlike overview brush). Does **not** multi-select events.
- Clear: toggle off, Esc, or clear control — clears `measureRange` and exits measure mode.
- **M2 minimum:** create range + clear + band + Δt label. Edge resize handles are optional polish.
- **Aside / other-view sync:** **Open [Q22](../context/OPEN_QUESTIONS.md)** — until answered, measure is a **local overlay only** (no PIPE/memory/summary recompute).

## Right panel coordination

- Aside **close (X)** clears `asideVisible` (equivalent to toolbar stats toggle off). See [StatsAside.spec.md](../../src/ui/StatsAside/StatsAside.spec.md).
- **更多** / More opens interim `HardwareDetailsPanel` (I-Q7a) when data exists and emits `open-hardware-details`.
- Aside modes (M1): overview drill-downs for Pipe details / Memory / Hardware — see [FEATURE_MATRIX](FEATURE_MATRIX.md) and changelog #2–#4.
- PIPE bars remain global mean aggregates ([I-Q6b](../context/INTERIM_DECISIONS.md)) unless Product later ties them to selection or measure (Q22).
- Detail / memory lists are **block-scoped** via block switcher ([I-Q6c](../context/INTERIM_DECISIONS.md)).
- Cube \| Vector toggle on PIPE for MIX ops only.
- PIPE section **详情** navigates to compute CSV details + emits `open-pipe-details`.
- Roofline (M2 interim I-Q11*): shown below PIPE when `report.roofline.points` non-empty; tabs omitted.
- Compute details: tabs PipeUtilization | ArithmeticUtilization | ResourceConflictRatio.
- Memory details: tabs Memory L1 | L2Cache | Memory L0 | Memory UB; **查看全部** opens full CSV ([I-Q6d](../context/INTERIM_DECISIONS.md)).
- Selecting a lane or event may filter lists later (still open); do not invent until Product confirms.

## Accessibility and robustness

- Tooltips must not block pan/zoom hit-testing incorrectly (dismiss on pan start).
- Large traces: hit-testing must use spatial index or GPU pick buffer when WebGL renderer is adopted (see [SWIMLANE_IMPLEMENTATIONS.md](../archive/research/SWIMLANE_IMPLEMENTATIONS.md)).
- Measure overlay must not steal hits when `measureMode` is false.