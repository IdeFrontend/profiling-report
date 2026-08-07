# ReportToolbar

| spec-id-prefix |
|----------------|
| PR-TOOLBAR-*   |

Top toolbar with search, zoom controls, time unit selector, measure toggle, and aside panel toggle.

Normative chrome: [`docs/specs/ui/components/VISUAL_SPEC.md`](../../../docs/specs/ui/components/VISUAL_SPEC.md) §5. Crops: [`toolbar-search.png`](../../../docs/specs/ui/components/toolbar-search.png), [`toolbar-zoom.png`](../../../docs/specs/ui/components/toolbar-zoom.png), [`toolbar-actions.png`](../../../docs/specs/ui/components/toolbar-actions.png).

## Inputs

All inputs reflect current state owned by the parent: **searchQuery** drives the search input via v-model, **zoomPercent** fills the slider (log2-scaled integer: 0=fit, higher=zoom-in), **timeUnit** sets the dropdown selection (ms/µs/ns), **asideVisible** and **asideAvailable** control toggle button state and visibility. Optional **locale** localizes button labels / `title` tooltips. Optional **title** shows in the toolbar header. Optional **measureMode** drives the caliper pressed state.

## Outputs

The toolbar emits user intent, not computed results. **zoom-in**, **zoom-out**, **zoom-to-fit** signal button clicks — the parent ProfilingReport computes the actual zoom. **update:zoomPercent** carries the slider value. **update:searchQuery** carries text input. **update:timeUnit** carries the selected unit. **update:asideVisible** toggles the panel. **update:measureMode** toggles measure mode.

## Behavior

**Zoom controls.** Toolbar buttons signal intent — the parent computes zoom around the viewport center. Visually, zoom is a **compound pill**: magnifying-glass− · slider · magnifying-glass+ (not separate square ± buttons).

**Search.** Pill field with stroke magnifying-glass SVG (not unicode `⌕`).

**Aside toggle.** Visible only when `asideAvailable` is true. Square icon button with panel SVG.

**Time unit switching.** Reformats displayed times across the UI. Control height matches other chrome (`28px`).

**Measure (M2).** Caliper button toggles measure mode; active state reflected in UI (`--on` / playhead blue).

**Zoom-to-fit.** Square icon button (fit/frame glyph), not a text label — keep accessible `title` via i18n.

## Visual (normative summary)

| Control | Chrome |
|---------|--------|
| Shared height | `28px` baseline |
| Search | Rounded rect `#2a2a2a`, radius `4px`, width `190px`, mag SVG `14×14` |
| Zoom | Rounded rect `#363636`, radius `4px`; mag± SVGs; slider fill `#e8e8e8` / thumb `#c8c8c8` |
| Icon actions | `28×28`, radius `4px`; active border/icon `#317AF7` |
| P2 sketch icons | Out of MVP — do not stub |

## Acceptance Criteria

1. **PR-TOOLBAR-001** — Emits update:searchQuery on text input.
2. **PR-TOOLBAR-002** — Emits zoom-in on button click.
3. **PR-TOOLBAR-003** — Emits `zoom-out` on button click.
4. **PR-TOOLBAR-004** — Emits `zoom-to-fit` on button click.
5. **PR-TOOLBAR-005** — Emits `update:timeUnit` on dropdown change.
6. **PR-TOOLBAR-006** — Emits `update:asideVisible` on toggle.
7. **PR-TOOLBAR-007** — Emits `update:measureMode` when measure button clicked.
8. **PR-TOOLBAR-008** — Search exposes a magnifier SVG; zoom root uses compound pill class; zoom ± are icon buttons (not bare text-only ± outside a pill).

## Edge Cases

- asideAvailable=false → toggle button hidden.
- Search query initially empty, user types to filter.

## Design sketches

- [toolbar-search.png](../../../docs/specs/ui/components/toolbar-search.png)
- [toolbar-zoom.png](../../../docs/specs/ui/components/toolbar-zoom.png)
- [toolbar-actions.png](../../../docs/specs/ui/components/toolbar-actions.png)
- [with_sidebar.png](../../../docs/specs/ui/with_sidebar.png)
- [changes.png](../../../docs/source/changes/changes.png) #1 (caliper)

## Changelog
- **2026-08-07** — Search/zoom corner radius `4px` (sketch), not capsule `14px`.
- **2026-08-07** — Visual tokens for search/zoom pills and square icon actions; PR-TOOLBAR-008.
- **2026-08-07** — Measure mode toggle (M2) on existing toolbar.
- **2026-08-05** — Initial spec.
