# ReportToolbar

| spec-id-prefix |
|----------------|
| PR-TOOLBAR-*   |

Top toolbar with search, zoom controls, time unit selector, measure toggle, and aside panel toggle.

Crops: [`visual/search.png`](./visual/search.png), [`visual/zoom.png`](./visual/zoom.png), [`visual/actions.png`](./visual/actions.png) — provenance in [`visual/provenance.yaml`](./visual/provenance.yaml).

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

## Visual

Source band ~y=400–472 in [`source/v930/entry.jpeg`](../../../docs/ui/source/v930/entry.jpeg) (device px @ dump resolution). Control height **~28–29 px** CSS.

### Search (`visual/search.png`)

| Token | Value |
|-------|--------|
| Height | `28px` |
| Width | `190px` |
| Shape | Rounded rect: `border-radius: 4px` (not capsule) |
| Background | `#2a2a2a` |
| Border | none (or `1px solid #3a3a3a` if needed) |
| Icon | Stroke magnifying glass SVG `14×14`, color `#9a9a9a`, left inset |
| Input padding | `0 12px 0 32px` |
| Placeholder | `#808080`; text `#e0e0e0`; font `12px` |

### Zoom pill (`visual/zoom.png`)

| Token | Value |
|-------|--------|
| Container | Single control, height `28px`, `border-radius: 4px`, bg `#363636` |
| Zoom out / in | Magnifying-glass SVGs with − / + inside (not bare ± text); `16×16`, color `#c8c8c8` |
| Buttons | Transparent, no separate square border; padding `4px 6px` |
| Slider | Width ~`100px`; track height `2px`; filled (left) `#e8e8e8`; unfilled `#2a2a2a`; thumb `10px` circle `#c8c8c8` |
| Gap | `4px` between icon / slider / icon inside pill |

### Action icon buttons (`visual/actions.png`)

| Token | Value |
|-------|--------|
| Size | Square `28×28` |
| Radius | `4px` |
| Border | `1px solid transparent` (hover: `#4a4a4a`) |
| Background | transparent / `#2a2a2a` on hover |
| Icon | Stroke or fill SVG `14×16`, color `#c8c8c8` |
| Active (`--on`) | bg `#1e3a5f`; icon/border `#317AF7` |
| Gap between buttons | `4px` |

Sketch shows **seven** action icons (measure, fit, chart, flag, deps, layers, help). MVP implements measure + fit; remaining icons stay visual-reference until their capabilities land. Time unit matches height `28px`; bg `#2a2a2a`; `border-radius: 4px`; font `12px`.

### Full strip (`visual/toolbar.png`)

Composite of search + zoom + actions at chrome height for layout spacing.

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

- [toolbar](./visual/toolbar.png) — full strip from `v930/entry`
- [search](./visual/search.png) — from `v930/entry`
- [zoom](./visual/zoom.png) — from `v930/entry`
- [actions](./visual/actions.png) — all seven icons from `v930/entry`
- [v930 entry](../../../docs/ui/source/v930/entry.jpeg) — full layout context
- [task-measure-mode](../../../docs/ui/source/v930/task-measure-mode.jpeg) — measure / caliper active

## Changelog
- **2026-08-07** — Search/zoom corner radius `4px` (sketch), not capsule `14px`.
- **2026-08-07** — Visual tokens for search/zoom pills and square icon actions; PR-TOOLBAR-008.
- **2026-08-07** — Measure mode toggle (M2) on existing toolbar.
- **2026-08-05** — Initial spec.
