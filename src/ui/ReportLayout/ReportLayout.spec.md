# ReportLayout

| spec-id-prefix |
|----------------|
| PR-LAYOUT-*    |

Main layout shell: two-column grid with main content area and optional right aside panel.

## Inputs

**showAside** controls whether the right column is rendered. **asideWidth** (px, default 360) sets the aside column width when visible. Content for both columns is passed via named slots: **main** (ReportToolbar + TimelineView: gutter, time axis, swimlane) and **aside** (stats, pipe occupancy). The toolbar lives only in **main** — it must not span above the aside.

## Outputs

**update:asideWidth** — emitted while dragging the aside left-edge resize handle (clamped 280–560).

## Behavior

The main column always renders as a vertical stack (toolbar strip, then timeline). The aside column is full height of the layout row (header flush with toolbar top). Aside width is user-resizable via a thin `ew-resize` handle on its left edge (`data-testid="aside-resize-handle"`). When `showAside` is false the column is removed from the DOM. The aside always stays in the right column; in narrow host panels the timeline and panels share a layout budget (see below).

Main column background is `--pr-bg-deep` (`#1f1f1f`). There is no full-width border across the top of the two-column grid (toolbar `border-bottom` only covers main).

**Aside seam.** `.pr-main` uses `overflow: visible` and `z-index: 1` so timeline top chrome (overview handles, cursor pill) may paint slightly over the aside seam. The grid uses `minmax(0, 1fr)` on the main column and `minmax(0, var(--pr-aside-width))` on the aside so both tracks can compress. Inner swim rows use `minmax(0, var(--pr-gutter-width)) minmax(80px, 1fr)` with `min-width: 0` so the gutter caps at the token while the track keeps a non-zero floor. Swimlane body scroll containment lives on the swim body row (`overflow: hidden`). The aside column stays at `z-index: 0` with `--pr-bg-panel`. `AxisRuler` clips its own tick labels so they never paint into the aside.

**Track budget.** ProfilingReport owns session gutter/aside widths (preferred + fitted). A `ResizeObserver` on the layout root runs `fitPanelWidths`: protect a **320px** swimlane track (`TIMELINE_TRACK_MIN`); shrink aside toward **280** first, then gutter toward **180**. User drag updates preferred sizes; expanding the host restores toward preferred. Gutter resize handle and swim cursor layer pin to the used grid columns (not a stale CSS-var `left`).

The parent ProfilingReport owns `asideWidth` (session-only) and also resizes the left lane gutter via `--pr-gutter-width` (180–480, default 280).

## Visual

Resizable panel chrome (gutter width owned by ProfilingReport; aside width by this shell):

| Token | Value |
|-------|--------|
| Gutter default / clamp | **280** / **180–480** px (`--pr-gutter-width`) |
| Aside default / clamp | **360** / **280–560** px |
| Track budget floor | **320** px (`TIMELINE_TRACK_MIN`) |
| Handle hit target | **5px** wide, `ew-resize`; hover tint `rgba(49,122,247,0.35)` |
| Persistence | Session-only (not localStorage) |
| Narrow layout | Fit aside then gutter to protect track; aside stays right (`minmax(0, …)` columns) |

## Acceptance Criteria

1. **PR-LAYOUT-001** — Renders main slot.
2. **PR-LAYOUT-002** — Shows aside panel.
3. **PR-LAYOUT-003** — Hides aside panel.
4. **PR-LAYOUT-004** — Exposes aside resize handle when aside is visible.
5. **PR-LAYOUT-005** — `.pr-main` is `overflow: visible` with `z-index: 1` so timeline edge chrome can overlap the aside seam; aside is `z-index: 0`.
6. **PR-LAYOUT-006** — Keeps two-column grid when aside is visible (`minmax(0, 1fr)` main track + `minmax(0, var(--pr-aside-width))` aside; no viewport stack).

## Edge Cases

- Both slots empty → empty shell renders without error.

## Design sketches

- [Entry overview](../../../docs/ui/source/v930/entry.jpeg) — two-column layout

## Changelog
- **2026-08-25** — Continuous `fitPanelWidths` budget (320px track); aside `minmax(0, …)`; preferred widths restore on grow.
- **2026-08-25** — Swim-row track floor `minmax(80px, 1fr)`; overlays pin to used columns.
- **2026-08-25** — Inner swim rows use `minmax(0, …)` so gutter + track shrink in narrow panels.
- **2026-08-24** — Drop timeline horizontal scroll; shrink-to-fit; seam overlap via `.pr-main` visible stacking; `minmax(0, 1fr)` outer grid; remove 900px stack.
- **2026-08-20** — `.pr-main` overflow visible above aside for timeline edge chrome; PR-LAYOUT-005.
- **2026-08-11** — Main slot hosts toolbar + timeline; aside full height; main bg `--pr-bg-deep`.
- **2026-08-10** — Absorbed resizable-panel tokens from retired `docs/ui/components/VISUAL_SPEC.md`.
- **2026-08-07** — Resizable aside width (drag handle + `asideWidth` prop).
- **2026-08-05** — Initial spec. Core behaviors established.
