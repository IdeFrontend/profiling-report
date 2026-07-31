# Interactions

Interaction specification for the Timeline view. Sketch references are under `docs/specs/ui/`.

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

**MVP gestures:** wheel scroll, Ctrl/Cmd+wheel zoom, drag pan, toolbar zoom / zoom-to-fit (table above). PyPTO keyboard shortcuts (W/S zoom, A/D pan) are **Phase 2** unless [Q19](../../context/OPEN_QUESTIONS.md) resolves otherwise — do not treat them as MVP parity.

## Hover

Sketch: `swimlane_hover.png`

- Hovering an event shows a tooltip: **name**, **start**, **duration**, **end** (ns or converted units).
- Highlight the hovered rectangle (outline or brightness).
- No selection change on hover alone.

**MVP:** required.

## Single selection

Sketches: `swimlane_selection.png`, `swimlane_selection2.png`

- Click event → selected state (distinct from hover).
- Populate detail region with at least name and start → duration (and end).
- Optional: dim non-selected events slightly.
- Click empty space → clear selection.

**MVP:** required. Full bottom dock with source paths and dependency graph → Phase 2.

## Multi-select

Sketch: `swimlane_multiselect.png`

- Additive selection (Shift/Ctrl click or rubber-band) of multiple events or a time range.
- Summary table: aggregate count, total duration, per-op breakdown.

**Phase 2+.**

## Context menu

Sketch: `swimlane_context_menu.png`

- Right-click lane or event → menu (e.g. **Pin row**, copy name, reveal in details).

**Phase 2+.**

## Dependencies

Sketch: `swimlane_selection.png` annotations

- Optional curved links between predecessor/successor events.
- Toolbar toggle to show/hide links.
- Detail panel: incoming / current / outgoing graph with depth filters (forward only / both / backward only).

**Phase 2+** — requires dependency data in trace args or side tables. Sample `out.rep` has no deps.

## Playhead / scrubbing

- Vertical line at current time; label with timestamp.
- Click/drag on ruler to move playhead (optional sync with overview charts).

**MVP:** show playhead tied to view center or last click; full scrub UX polish can follow.

## Search

- Query filters or highlights matching event names.
- Enter / next / previous jump to matches (Phase 2 polish; MVP may highlight only).

**MVP:** basic substring filter or highlight.

## Right panel coordination

- Selecting a lane or block may filter pipe/memory detail lists (Phase 2).
- PIPE bars remain global aggregates for MVP unless selection defines a subset.

## Accessibility and robustness

- Tooltips must not block pan/zoom hit-testing incorrectly (dismiss on pan start).
- Large traces: hit-testing must use spatial index or GPU pick buffer when WebGL renderer is adopted (see [SWIMLANE_IMPLEMENTATIONS.md](../../research/SWIMLANE_IMPLEMENTATIONS.md)).
