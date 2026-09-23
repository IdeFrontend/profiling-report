# MultiSelectSummary

| spec-id-prefix |
|----------------|
| PR-MSEL-*      |

The marquee multi-select summary dock. Mounted by ProfilingReport when a marquee (or Shift+click toggle set) commits a multi-selection of **two or more** events, and also while a live marquee preview covers ≥2 events; a one-event commit or preview is demoted to single-select DetailPanel. Mutually exclusive with the single-select DetailPanel.

## Inputs

**selectedEvents** — the multi-selection (`SwimEvent[]`), from a commit or a settled live marquee preview. **model** — the full `SwimlaneModel`, used to derive the average wall duration across the whole model (not just the selection). **locale** — UI language. **height** (optional) — the dock height in px, owned by the parent (default `DOCK_HEIGHT_COLLAPSED`). **livePreview** — while the marquee is still in flight, the header count comes from `liveCount` when present and the table is non-interactive. **liveCount** — optional union size when `selectedEvents` is not the live set (ids-only preview). **dimmed** — while the marquee is still growing (within the settle window), the table stays mounted with reduced opacity.

## Outputs

**close** fires when the header × is clicked. **select-single** fires with the full `SwimEvent` when a row's name is clicked, so the parent swaps the multi-select dock for the single-select DetailPanel. **update:height** fires when the centred expander is clicked, so the parent keeps owning the dock height.

## Behavior

The dock shows a header with the selection count and the "Slices" tab label, a sortable four-column table (**Name**, **Wall Duration**, **Self time**, **Average Wall Duration**), and a × close button. The table body scrolls inside the dock (the dock itself does not grow with content). At most 1000 events stay in the ranked data window; the table virtualizes to the visible viewport (plus a small overscan) rather than mounting 1000 `<tr>`s. A larger selection reports "Showing 1000 of N" while numeric bars still scale against the complete selection. While **dimmed** the table stays mounted with its stale rows dimmed (reduced opacity) instead of unmounting — the parent recalculates it once the selection settles. While **livePreview** the table stays non-interactive for the whole live gesture (name clicks and column sort are disabled), independent of the dim state. Sorting starts as Wall Duration descending; clicking a header alternates ascending ↔ descending, every header carries the drawn sort arrows, and the active column is highlighted. A centred expander on the top edge toggles the dock between its two fixed heights (collapsed / expanded); there is no drag resize.

## Acceptance Criteria

1. **PR-MSEL-001** — Header shows count and Slices tab label.
2. **PR-MSEL-002** — Table lists selected events across four columns.
3. **PR-MSEL-003** — Default sort is Wall Duration descending; header alternates asc ↔ desc.
4. **PR-MSEL-004** — Numeric cells carry a bar proportional to the column max.
5. **PR-MSEL-005** — Clicking a name emits `select-single` with the full event.
6. **PR-MSEL-006** — Header × emits `close`.
7. **PR-MSEL-007** — The centred expander toggles the dock between its two sketch heights and carries `aria-expanded`; no resize handle exists.
8. **PR-MSEL-008** — The table body scrolls, not the dock; large selections keep 1000 ranked rows with the visible count, and the DOM window is the viewport. Ranked-row cells are a fixed 29px (`box-sizing: border-box`) so `scrollTop / ROW_HEIGHT_PX` matches layout.
9. **PR-MSEL-009** — Live preview keeps the header count and omits the visible-row note; `liveCount` supplies the count when `selectedEvents` is empty.
10. **PR-MSEL-010** — `dimmed` keeps the stale table mounted with reduced opacity instead of unmounting it.
11. **PR-MSEL-011** — `livePreview` keeps the table non-interactive for the whole live gesture, even after the dim clears.

## Changelog

- **2026-09-23** — `livePreview` keeps the table non-interactive for the whole gesture, separate from the `dimmed` stale window (`PR-MSEL-011`).
- **2026-09-23** — `dimmed` keeps the stale table mounted (dimmed) while the marquee is still growing; the table recalculates on settle/commit (`PR-MSEL-010`).
- **2026-09-22** — Live header count may come from `liveCount` without a `selectedEvents` array (`PR-MSEL-009`).
- **2026-09-22** — Ranked-row cells are a fixed 29px so virtualizer math matches layout (`PR-MSEL-008`).
- **2026-09-18** — Committed table virtualizes the viewport; live preview is header-only (`PR-MSEL-008` / `PR-MSEL-009`).
- **2026-09-12** — May also mount from a live marquee preview (≥2 events) before commit.
- **2026-09-12** — Dock mounts only for commits of two or more events; a one-event marquee is demoted to DetailPanel by the root.
- **2026-08-26** — Multi-select summary dock for the marquee commit path.
- **2026-09-11** — PR-MSEL-007 recast: the drag handle becomes the centred expander, matching DetailPanel's two-height collapse/expand; the dock's free height range becomes two fixed heights.
