# ReportToolbar

| spec-id-prefix |
|----------------|
| PR-TOOLBAR-*   |

Top toolbar with search, zoom controls, display-control popover (task display unit), and aside panel toggle. Measure (caliper) toggle is temporarily hidden from chrome.

Crops: [`visual/search.png`](./visual/search.png), [`visual/zoom.png`](./visual/zoom.png), [`visual/actions.png`](./visual/actions.png) — provenance in [`visual/provenance.yaml`](./visual/provenance.yaml).

## Inputs

All inputs reflect current state owned by the parent: **searchQuery** drives the search input via v-model, **zoomPercent** fills the slider (log2-scaled integer: 0=fit, higher=zoom-in), **timeDisplayMode** sets the popover dropdown (`time` / `cycles`), optional **clockFreqMHz** shows the clocks option when set, **dependencyMode** sets the dependency-display dropdown (`all` / `predecessors` / `successors`), **dependencyDepth** sets hop count (default `1`, min `-1` = no hop cap, max `MAX_DEPENDENCY_DEPTH` = 100; walk is capped at 10 000 links per side), **asideVisible** and **asideAvailable** control toggle button state and visibility. Optional **locale** localizes button labels / `title` tooltips. Optional **title** shows in the toolbar header. Optional **measureMode** drives the caliper pressed state.

## Outputs

The toolbar emits user intent, not computed results. **zoom-in**, **zoom-out**, **zoom-to-fit** signal button clicks — the parent ProfilingReport computes the actual zoom. **update:zoomPercent** carries the slider value. **update:searchQuery** carries text input. **update:timeDisplayMode** carries `time` or `cycles`. **update:dependencyMode** carries the selected dependency filter. **update:dependencyDepth** carries the hop count. **update:asideVisible** toggles the panel. **update:measureMode** toggles measure mode.

## Behavior

**Zoom controls.** Toolbar buttons signal intent — the parent computes zoom around the viewport center. Visually, zoom is a **compound pill**: magnifying-glass− · slider · magnifying-glass+ (not separate square ± buttons).

**Search.** Pill field with stroke magnifying-glass SVG (not unicode `⌕`).

**Aside toggle.** Visible only when `asideAvailable` is true. Square icon button with panel SVG.

**Display control.** Not an inline toolbar `<select>`. A **layers** icon button (`data-testid="toggle-display-control"`) opens a floating **显示控制** popover (`data-testid="display-control"`) with **任务显示单位** (`data-testid="time-display-mode"`: Time (auto) / CPU clocks per [I-Q14](../../../docs/context/INTERIM_DECISIONS.md); clocks option only when **clockFreqMHz** is set), **依赖显示** (`data-testid="dependency-mode"`: all / predecessors / successors), and **依赖深度** (`data-testid="dependency-depth"`: integer, default 1, min −1 = no hop cap, max 100; tooltip notes the 10 000-link-per-side cap). Toggle the button or click **X** to close; leave open after mode or depth change. Changing dependency mode or depth must not reload the page.

**Measure (M2).** Temporarily hidden from the toolbar. Prop/emit (`measureMode` / `update:measureMode`) and canvas measure wiring remain so the caliper can be restored later.

**Zoom-to-fit.** Square icon button (fit/frame glyph), not a text label — keep accessible `title` via i18n.

## Visual

Source band ~y=400–472 in [`source/v930/entry.jpeg`](../../../docs/ui/source/v930/entry.jpeg) (device px @ dump resolution). Control height **~28–29 px** CSS.

Lives in the **main** column only (above the timeline), not spanning the StatsAside — see [ReportLayout](../ReportLayout/ReportLayout.spec.md).

### Strip

| Token | Value |
|-------|--------|
| Background | `#1f1f1f` (`--pr-bg-deep`) |
| Border | `1px solid #3a3a3a` bottom |

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
| Slider | Width ~`100px`; track height `2px`; filled (left) `#ffffff`; unfilled `#1a1a1a`; thumb `10px` circle `#c8c8c8` |
| Gap | `4px` between icon / slider / icon inside pill |

### Action icon buttons (`visual/actions.png`)

Resting fill from `v930/entry` actions strip; hover/pressed from `v930/hardware-more-detail` (layers under cursor + active chart).

| Token | Value |
|-------|--------|
| Size | Square `28×28` |
| Radius | `6px` |
| Border | none (no stroke ring) |
| Background (rest) | `#363636` (not transparent) |
| Icon (rest) | `#b3b3b3` |
| Hover / `:active` / `--on` / `aria-pressed` / `aria-expanded` | bg `#1e2a3e`; icon `#2d70e3` |
| Gap between buttons | `4px` |

Sketch shows **seven** action icons (measure, fit, chart, flag, deps, layers, help). MVP implements fit + **layers → 显示控制**; measure is temporarily hidden; remaining icons stay visual-reference until their capabilities land.

### Display control popover

Source / crop: [`v930/hardware-more-detail`](../../../docs/ui/source/v930/hardware-more-detail.jpeg), [`visual/display-control.png`](./visual/display-control.png).

| Token | Value |
|-------|--------|
| Trigger | Layers (stacked diamonds) SVG; `aria-expanded`; `--on` when open |
| Panel bg | `#363636` |
| Panel border | `1px solid #5e5e5e` |
| Panel radius | `12px` |
| Panel padding | `20px 22px 22px` |
| Shadow | soft `0 6px 20px rgba(0,0,0,0.55)` |
| Title | `13px` / `600` / `#ffffff` |
| Close | thin `#e6e6e6` × |
| Section label | `12px` / `#b2b2b2` |
| Select bg | `#404040` |
| Select radius | `6px` |
| Select height | `32px`; text `#ffffff`; custom chevron (no native arrow) |
| Options | Time (auto) always; CPU clocks when `clockFreqMHz` set ([I-Q14](../../../docs/context/INTERIM_DECISIONS.md)) |

### Full strip (`visual/toolbar.png`)

Composite of search + zoom + actions at chrome height for layout spacing.

## Acceptance Criteria

1. **PR-TOOLBAR-001** — Emits update:searchQuery on text input.
2. **PR-TOOLBAR-002** — Emits zoom-in on button click.
3. **PR-TOOLBAR-003** — Emits `zoom-out` on button click.
4. **PR-TOOLBAR-004** — Emits `zoom-to-fit` on button click.
5. **PR-TOOLBAR-005** — Layers opens 显示控制; mode select emits `update:timeDisplayMode`.
5. **PR-TOOLBAR-005b** — Cycles option hidden without freq.
6. **PR-TOOLBAR-006** — Emits `update:asideVisible` on toggle.
7. **PR-TOOLBAR-007** — Measure toggle (`toggle-measure`) is not rendered (temporarily hidden).
8. **PR-TOOLBAR-008** — Search exposes a magnifier SVG; zoom root uses compound pill class; zoom ± are icon buttons (not bare text-only ± outside a pill).
9. **PR-TOOLBAR-009** — Strip uses `--pr-bg-deep`; search `#2a2a2a`; zoom pill `#363636`; zoom track filled `#ffffff` / unfilled `#1a1a1a`.
10. **PR-TOOLBAR-010** — Display-control popover closes via X or toggling the layers button.
11. **PR-TOOLBAR-011** — `dependency-mode` select inside 显示控制 emits `update:dependencyMode` on change; popover stays open.
12. **PR-TOOLBAR-012** — `dependency-depth` input inside 显示控制 emits `update:dependencyDepth` on change (values below −1 clamp to −1, above 100 clamp to 100); popover stays open.

## Edge Cases

- asideAvailable=false → toggle button hidden.
- Search query initially empty, user types to filter.
- Popover closed → `time-display-mode` not in DOM (or not visible).

## Design sketches

- [toolbar](./visual/toolbar.png) — full strip from `v930/entry`
- [search](./visual/search.png) — from `v930/entry`
- [zoom](./visual/zoom.png) — from `v930/entry`
- [actions](./visual/actions.png) — all seven icons from `v930/entry`
- [display-control](./visual/display-control.png) — from `v930/hardware-more-detail`
- [v930 entry](../../../docs/ui/source/v930/entry.jpeg) — full layout context
- [hardware-more-detail](../../../docs/ui/source/v930/hardware-more-detail.jpeg) — 显示控制 popover + layers trigger
- [task-measure-mode](../../../docs/ui/source/v930/task-measure-mode.jpeg) — measure / caliper active

## Changelog
- **2026-08-18** — Depth input clamps to `MAX_DEPENDENCY_DEPTH` (100); `max` attribute set on `<input>`.
- **2026-08-17** — Depth tooltip notes 10 000-link-per-side cap.
- **2026-08-17** — Dependency depth number field in 显示控制 (default 1, −1 no hop cap); PR-TOOLBAR-012.
- **2026-08-14** — Dependency display dropdown in 显示控制 (all / predecessors / successors); PR-TOOLBAR-011.
- **2026-08-11** — Action icon rest `#363636` / `#b3b3b3`; hover & pressed `#1e2a3e` / `#2d70e3`; radius `6px` (sketch-sampled).
- **2026-08-11** — Display-control popover tokens from sketch: panel `#363636` / radius `12px` / border `#5e5e5e`; select `#404040` / radius `6px`.
- **2026-08-11** — Time unit via layers → 显示控制 popover (not inline select); PR-TOOLBAR-005/010.
- **2026-08-11** — Strip `#1f1f1f`; zoom track filled `#ffffff` / unfilled `#1a1a1a`; toolbar main-column only.
- **2026-08-11** — Measure caliper toggle temporarily hidden from toolbar chrome.
- **2026-08-07** — Search/zoom corner radius `4px` (sketch), not capsule `14px`.
- **2026-08-07** — Visual tokens for search/zoom pills and square icon actions; PR-TOOLBAR-008.
- **2026-08-07** — Measure mode toggle (M2) on existing toolbar.
- **2026-08-05** — Initial spec.
