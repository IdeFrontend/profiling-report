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

The main column always renders as a vertical stack (toolbar strip, then timeline). The aside column is full height of the layout row (header flush with toolbar top). Aside width is user-resizable via a thin `ew-resize` handle on its left edge (`data-testid="aside-resize-handle"`). When `showAside` is false the column is removed from the DOM. Handles are hidden under `max-width: 900px` (single-column layout).

Main column background is `--pr-bg-deep` (`#1f1f1f`). There is no full-width border across the top of the two-column grid (toolbar `border-bottom` only covers main).

The parent ProfilingReport owns `asideWidth` (session-only) and also resizes the left lane gutter via `--pr-gutter-width` (180–480, default 280).

## Visual

Resizable panel chrome (gutter width owned by ProfilingReport; aside width by this shell):

| Token | Value |
|-------|--------|
| Gutter default / clamp | **280** / **180–480** px (`--pr-gutter-width`) |
| Aside default / clamp | **360** / **280–560** px |
| Handle hit target | **5px** wide, `ew-resize`; hover tint `rgba(49,122,247,0.35)` |
| Persistence | Session-only (not localStorage) |
| Narrow layout | Handles hidden at `max-width: 900px` |

## Acceptance Criteria

1. **PR-LAYOUT-001** — Renders main slot.
2. **PR-LAYOUT-002** — Shows aside panel.
3. **PR-LAYOUT-003** — Hides aside panel.
4. **PR-LAYOUT-004** — Exposes aside resize handle when aside is visible.

## Edge Cases

- Both slots empty → empty shell renders without error.

## Design sketches

- [Entry overview](../../../docs/ui/source/v930/entry.jpeg) — two-column layout

## Changelog
- **2026-08-11** — Main slot hosts toolbar + timeline; aside full height; main bg `--pr-bg-deep`.
- **2026-08-10** — Absorbed resizable-panel tokens from retired `docs/ui/components/VISUAL_SPEC.md`.
- **2026-08-07** — Resizable aside width (drag handle + `asideWidth` prop).
- **2026-08-05** — Initial spec. Core behaviors established.
