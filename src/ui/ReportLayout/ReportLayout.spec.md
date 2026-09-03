# ReportLayout

| spec-id-prefix |
|----------------|
| PR-LAYOUT-*    |

Main layout shell: two-column grid with main content area and optional right aside panel.

## Inputs

**showAside** controls whether the right column is rendered. **asideWidth** (px, default **480**) sets the aside column width when visible. Content for both columns is passed via named slots: **main** (ReportToolbar + TimelineView: gutter, time axis, swimlane) and **aside** (stats, pipe occupancy). The toolbar lives only in **main** — it must not span above the aside.

## Outputs

**update:asideWidth** — emitted while dragging the aside resize handle (`data-testid="aside-resize-handle"`).

## Behavior

The main column always renders as a vertical stack (toolbar strip, then timeline). The aside column is full height of the layout row (header flush with toolbar top). Aside opens at **480px** (Product default) and is **user-resizable** via a left-edge `ew-resize` handle (drag left to widen). Clamp **280–720**. When `showAside` is false the column is removed from the DOM. The aside always stays in the right column; in narrow host panels the timeline and panels share a layout budget (see below).

Main column background is `--pr-bg-deep` (`#1f1f1f`). There is no full-width border across the top of the two-column grid (toolbar `border-bottom` only covers main).

**Aside seam.** `.pr-main` uses `overflow: visible` and `z-index: 1` so timeline top chrome (overview handles, cursor pill) may paint slightly over the aside seam. The grid uses `minmax(0, 1fr)` on the main column and `minmax(0, var(--pr-aside-width))` on the aside so both tracks can compress — **no horizontal scrollbar**. Inner swim rows use `minmax(0, var(--pr-gutter-width)) minmax(80px, 1fr)` with `min-width: 0` so the gutter caps at the token while the track keeps a non-zero floor. Swimlane body scroll containment lives on the swim body row (`overflow: hidden`). The aside column stays at `z-index: 0` with `--pr-bg-aside` and `overflow: hidden` so aside content reflows inside the column. `AxisRuler` clips its own tick labels so they never paint into the aside.

**Track budget.** ProfilingReport owns session gutter + aside widths (preferred + fitted). A `ResizeObserver` on the layout root runs `fitPanelWidths`: protect a **320px** swimlane track (`TIMELINE_TRACK_MIN`); shrink **aside** toward **280**, then **gutter** toward **180**, when the host is narrow. User drag updates preferred sizes; expanding the host restores toward preferred. Gutter resize handle pins to the used gutter column via explicit `grid-column: 1 / 2` (not a stale CSS-var `left`; abspos `grid-column: 1` alone would park on the container edge).

The parent ProfilingReport owns gutter width via `--pr-gutter-width` (180–480, default 280) and aside width via `--pr-aside-width` (280–720, default **480**).

## Visual

Resizable panel chrome (widths owned by ProfilingReport; handle lives here):

| Token | Value |
|-------|--------|
| Gutter default / clamp | **280** / **180–480** px (`--pr-gutter-width`) |
| Aside default / clamp | **480** / **280–720** px (`--pr-aside-width`) |
| Track budget floor | **320** px (`TIMELINE_TRACK_MIN`) |
| Aside resize handle | 5px hit target on left seam, `ew-resize`, hover/active `rgba(49,122,247,0.35)` |
| Narrow layout | Fit **aside** then **gutter** to protect track; aside stays right (fixed grid column); no horizontal scroll |

## Acceptance Criteria

1. **PR-LAYOUT-001** — Renders main slot.
2. **PR-LAYOUT-002** — Shows aside panel.
3. **PR-LAYOUT-003** — Hides aside panel.
4. **PR-LAYOUT-004** — Aside opens at **480px** with a left-edge resize handle (`aside-resize-handle`) that emits `update:asideWidth`.
5. **PR-LAYOUT-005** — `.pr-main` is `overflow: visible` with `z-index: 1` so timeline edge chrome can overlap the aside seam; aside is `z-index: 0` with `--pr-bg-aside`.
6. **PR-LAYOUT-006** — Keeps two-column grid when aside is visible (`minmax(0, 1fr)` main + `minmax(0, var(--pr-aside-width))` aside; no viewport stack).

## Edge Cases

- Both slots empty → empty shell renders without error.

## Design sketches

- [Entry overview](../../../docs/ui/source/v930/entry.jpeg) — two-column layout

## Changelog
- **2026-09-03** — Restore aside resize handle; default open **480px**, clamp **280–720**; narrow fit shrinks aside then gutter (no horizontal scroll).
- **2026-09-02** — Aside fixed **480px** (Product); roofline chart scales to **440×303**. *(Superseded — resize restored; see above.)*
- **2026-09-01** — Aside fixed **468px** (v930 sketch); resize handle removed; narrow fit shrinks gutter only. *(Superseded.)*
- **2026-08-28** — Aside column uses `--pr-bg-aside` (`#1a1a1a`, `detail-strip-raised` gutter).
- **2026-08-25** — Continuous `fitPanelWidths` budget (320px track); aside `minmax(0, …)`; preferred widths restore on grow.
- **2026-08-25** — Swim-row track floor `minmax(80px, 1fr)`; overlays pin to used columns.
- **2026-08-25** — Inner swim rows use `minmax(0, …)` so gutter + track shrink in narrow panels.
- **2026-08-24** — Drop timeline horizontal scroll; shrink-to-fit; seam overlap via `.pr-main` visible stacking; `minmax(0, 1fr)` outer grid; remove 900px stack.
- **2026-08-20** — `.pr-main` overflow visible above aside for timeline edge chrome; PR-LAYOUT-005.
- **2026-08-11** — Main slot hosts toolbar + timeline; aside full height; main bg `--pr-bg-deep`.
- **2026-08-10** — Absorbed resizable-panel tokens from retired `docs/ui/components/VISUAL_SPEC.md`.
- **2026-08-07** — Resizable aside width (drag handle + `asideWidth` prop).
- **2026-08-05** — Initial spec. Core behaviors established.
