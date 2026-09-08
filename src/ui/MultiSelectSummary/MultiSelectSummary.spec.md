# MultiSelectSummary

| spec-id-prefix |
|----------------|
| PR-MSEL-*      |

The marquee multi-select summary dock. Mounted by ProfilingReport when a marquee (or Shift+click toggle set) commits a non-empty multi-selection; it is mutually exclusive with the single-select DetailPanel.

## Inputs

**selectedEvents** — the committed multi-selection (`SwimEvent[]`). **model** — the full `SwimlaneModel`, used to derive the average wall duration across the whole model (not just the selection). **locale** — UI language. **height** (optional) — the dock height in px, owned by the parent (default `DOCK_HEIGHT_EXPANDED`).

## Outputs

**close** fires when the header × is clicked. **select-single** fires with the full `SwimEvent` when a row's name is clicked, so the parent swaps the multi-select dock for the single-select DetailPanel. **update:height** fires as the top edge is dragged, so the parent keeps owning the dock height.

## Behavior

The dock shows a header with the selection count and the "Slices" tab label, a sortable four-column table (**Name**, **Wall Duration**, **Self time**, **Average Wall Duration**), and a × close button. The table body scrolls inside the dock (the dock itself does not grow with content). Numeric cells draw a bar proportional to the column's maximum value. Sorting starts as Wall Duration descending; clicking a header cycles ascending → descending → unsorted, every header carries the drawn sort arrows, and the active column is highlighted. Dragging the top edge resizes the dock, clamped at a floor.

## Acceptance Criteria

1. **PR-MSEL-001** — Header shows count and Slices tab label.
2. **PR-MSEL-002** — Table lists every selected event across four columns.
3. **PR-MSEL-003** — Default sort is Wall Duration descending; header cycles asc → desc → unsorted.
4. **PR-MSEL-004** — Numeric cells carry a bar proportional to the column max.
5. **PR-MSEL-005** — Clicking a name emits `select-single` with the full event.
6. **PR-MSEL-006** — Header × emits `close`.
7. **PR-MSEL-007** — Dragging the top edge up grows the dock and clamps at the floor.
8. **PR-MSEL-008** — The table body scrolls, not the dock.

## Changelog

- **2026-08-26** — Multi-select summary dock for the marquee commit path.
