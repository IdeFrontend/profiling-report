# ReportToolbar

| spec-id-prefix |
|----------------|
| PR-TOOLBAR-*   |

Top toolbar with search, zoom controls, display-control popover (task display unit), measure (bars + Δt arrow) toggle, and aside panel toggle.

Crops: [`visual/search.png`](./visual/search.png), [`visual/zoom.png`](./visual/zoom.png), [`visual/actions.png`](./visual/actions.png), [`visual/measure-active.png`](./visual/measure-active.png), [`visual/op-selector.png`](./visual/op-selector.png), [`visual/op-selector-tabs.png`](./visual/op-selector-tabs.png), [`visual/op-selector-open.png`](./visual/op-selector-open.png) — provenance in [`visual/provenance.yaml`](./visual/provenance.yaml).

## Inputs

All inputs reflect current state owned by the parent: **searchQuery** drives the search input via v-model, **zoomPercent** fills the slider (log2-scaled integer: 0=fit / full span, 100=min window — same floor as Ctrl+wheel/`zoomAt`, not “1/100 of full”), **timeUnit** sets the popover dropdown selection (ms/µs/ns), **dependencyDepth** sets hop count (default `1`, min `-1` = no hop cap, max `MAX_DEPENDENCY_DEPTH` = 100; walk is capped at 10 000 links per side), **asideVisible** and **asideAvailable** control toggle button state and visibility. Optional **locale** localizes button labels / `title` tooltips. Optional **title** shows in the toolbar header. Optional **measureMode** drives the caliper pressed state. Optional **operators** / **selectedOperatorId** drive the top-left OP selector (multi-operator packs only).

## Outputs

The toolbar emits user intent, not computed results. **zoom-in**, **zoom-out**, **zoom-to-fit** signal button clicks — the parent ProfilingReport computes the actual zoom. **update:zoomPercent** carries the slider value. **update:searchQuery** carries text input. **update:timeUnit** carries the selected unit. **update:dependencyDepth** carries the hop count. **update:asideVisible** toggles the panel. **update:measureMode** toggles measure mode. **update:selectedOperatorId** carries the chosen operator id from the OP selector.

## Behavior

**Zoom controls.** Toolbar buttons signal intent — the parent computes zoom around the viewport center. Visually, zoom is a **compound pill**: magnifying-glass− · slider · magnifying-glass+ (not separate square ± buttons).

**Search.** Pill field with stroke magnifying-glass SVG (not unicode `⌕`).

**Aside toggle.** Visible only when `asideAvailable` is true. Square icon button with panel SVG.

**Display control.** Not an inline toolbar `<select>`. A **layers** icon button (`data-testid="toggle-display-control"`) opens a floating **显示控制** popover (`data-testid="display-control"`) with **任务显示单位** (`data-testid="time-unit"`: ms / µs / ns per [I-Q14](../../../docs/context/INTERIM_DECISIONS.md)). Toggle the button or click **X** to close; leave open after a unit change. Sketch may show 时钟周期 — MVP does **not** offer cycle mode. Also carries **任务连接层级** (`data-testid="dependency-depth"`, `update:dependencyDepth`): how many hops the swimlane dependency graph walks, `-1` for the whole chain, normalized through `normalizeDependencyDepth` so a cleared field yields the shared default rather than `NaN`. It commits on `change`, not per keystroke — a half-typed number must not rebuild the graph. Dependency *direction* is not here: it filters what the selected event shows, so it lives in the detail dock's [Relevent](../DetailPanel/DetailRelevant/DetailRelevant.spec.md) toolbar.

**Measure (M2).** A measure icon button between zoom-to-fit and display-control toggles measure mode. The button reflects the `measureMode` prop via `aria-pressed` and the `--on` class (shared with the other active action-icon states) and emits `update:measureMode` with the new boolean on click.

**Measure icon geometry (`visual/measure-active.png`).** Two vertical rounded bars with a horizontal double-headed Δt arrow between them. Arrowheads are **open stroke chevrons** (two diagonal lines only — `fill="none"`, never solid triangles). Leave a **~1px gap** between each chevron tip and the adjacent vertical bar (tips must not touch the bars). Stroke weight matches the bars.

**OP selector (multi-operator packs).** Rendered at the far left of the tab strip (replacing the brand) when `operators` has more than one entry. Sketch ([`visual/op-selector.png`](./visual/op-selector.png), [`visual/op-selector-open.png`](./visual/op-selector-open.png)): **text + thin chevron only** — no pill fill, no vertical divider. Trigger label shows the **selected operator** label (e.g. `op1` / `op2`); menu lists all operators. Chevron points down when closed, up when open. Selecting a menu item emits `update:selectedOperatorId` and closes the menu (re-selecting the active id does not emit). Keyboard: ArrowDown/Enter/Space open; Escape closes; ArrowUp/Down move; Enter/Space select. With zero or one operator, the static brand (`title` / OP算子) is shown instead.

**Zoom-to-fit.** Square icon button (fit/frame glyph), not a text label — keep accessible `title` via i18n.

## Visual

Source band ~y=400–472 in [`source/v930/entry.jpeg`](../../../docs/ui/source/v930/entry.jpeg) (device px @ dump resolution). Control height **~28–29 px** CSS.

Lives in the **main** column only (above the timeline), not spanning the StatsAside — see [ReportLayout](../ReportLayout/ReportLayout.spec.md).

### Strip

| Token | Value |
|-------|--------|
| Background | `#1f1f1f` (`--pr-bg-deep`) |
| Border | `1px solid #3a3a3a` bottom |
| Corner wash | Owned by ProfilingReport — 208×60 top-left blue fade (see root spec) |

### OP selector (`visual/op-selector.png`, `visual/op-selector-open.png`)

Source: [`v930/entry`](../../../docs/ui/source/v930/entry.jpeg) (closed), [`v930/hardware-more-detail`](../../../docs/ui/source/v930/hardware-more-detail.jpeg) (open). Context: [`visual/op-selector-tabs.png`](./visual/op-selector-tabs.png).

| Token | Value |
|-------|--------|
| Trigger | Transparent — **no** pill fill, **no** border, **no** vertical divider |
| Trigger label | Selected operator label (e.g. `op1`) — white, 18px / weight 700 / line-height 26px / letter-spacing 0 |
| Chevron | Thin stroke `10×10`, color `#c8c8c8`; down when closed, rotated 180° when open |
| Gap label↔chevron | `4px` |
| Menu bg | `#363636` |
| Menu radius | `8px` |
| Menu border | `1px solid #4a4a4a` |
| Item text | `#d0d0d0` / 12px; active `#ffffff` on `#2a3550` |
| Visible when | `operators.length > 1` |

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

Sketch shows **seven** action icons (fit, measure, chart, flag, deps, layers, help). MVP implements fit, measure (caliper), and **layers → 显示控制**; remaining icons (chart, flag, deps, help) stay visual-reference until their capabilities land.

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
| Options (MVP) | ms / µs / ns ([I-Q14](../../../docs/context/INTERIM_DECISIONS.md); sketch may show 时钟周期) |

### Full strip (`visual/toolbar.png`)

Composite of search + zoom + actions at chrome height for layout spacing.

## Acceptance Criteria

1. **PR-TOOLBAR-001** — Emits update:searchQuery on text input.
2. **PR-TOOLBAR-002** — Emits zoom-in on button click.
3. **PR-TOOLBAR-003** — Emits `zoom-out` on button click.
4. **PR-TOOLBAR-004** — Emits `zoom-to-fit` on button click.
5. **PR-TOOLBAR-005** — Layers button opens 显示控制; `time-unit` select inside emits `update:timeUnit` on change; select is not visible until popover open.
6. **PR-TOOLBAR-006** — Emits `update:asideVisible` on toggle.
7. **PR-TOOLBAR-007** — Measure toggle (`toggle-measure`) renders bars + open stroke Δt arrow (chevron heads, gap from bars); emits `update:measureMode` on click.
8. **PR-TOOLBAR-007b** — Active measure toggle uses `aria-pressed="true"` and `--on`.
9. **PR-TOOLBAR-007c** — Measure SVG arrowheads use `fill="none"` (stroke chevrons only; no filled triangle paths).
10. **PR-TOOLBAR-008** — Search exposes a magnifier SVG; zoom root uses compound pill class; zoom ± are icon buttons (not bare text-only ± outside a pill).
11. **PR-TOOLBAR-009** — Strip uses `--pr-bg-deep`; search `#2a2a2a`; zoom pill `#363636`; zoom track filled `#ffffff` / unfilled `#1a1a1a`.
12. **PR-TOOLBAR-010** — Display-control popover closes via X or toggling the layers button.
13. **PR-TOOLBAR-011** — 显示控制 carries the dependency depth field; emits normalized on change.
14. **PR-TOOLBAR-013** — OP selector renders for multiple operators; trigger shows selected operator label; menu lists operators; selecting emits `update:selectedOperatorId`; Escape/Enter/Arrow supported; re-select does not emit; open state clears when selector unmounts.
15. **PR-TOOLBAR-014** — OP selector hidden for zero or one operator (brand shown).
16. **PR-TOOLBAR-015** — OP selector is text+chevron (transparent, no pill/divider); trigger type is 18px / 700 / 26px lh.

## Edge Cases

- asideAvailable=false → toggle button hidden.
- Search query initially empty, user types to filter.
- Popover closed → `time-unit` not in DOM (or not visible).

## Design sketches

- [toolbar](./visual/toolbar.png) — full strip from `v930/entry`
- [search](./visual/search.png) — from `v930/entry`
- [zoom](./visual/zoom.png) — from `v930/entry`
- [actions](./visual/actions.png) — all seven icons from `v930/entry`
- [measure-active](./visual/measure-active.png) — active measure icon (bars + open stroke Δt arrow) from `v930/task-measure-mode`
- [display-control](./visual/display-control.png) — from `v930/hardware-more-detail`
- [op-selector](./visual/op-selector.png) — closed OP算子 text+chevron from `v930/entry`
- [op-selector-tabs](./visual/op-selector-tabs.png) — OP + 时间线 context + chrome gradient from `v930/entry`
- [op-selector-open](./visual/op-selector-open.png) — open menu from `v930/hardware-more-detail`
- [v930 entry](../../../docs/ui/source/v930/entry.jpeg) — full layout context
- [hardware-more-detail](../../../docs/ui/source/v930/hardware-more-detail.jpeg) — 显示控制 popover + layers trigger + open OP menu
- [task-measure-mode](../../../docs/ui/source/v930/task-measure-mode.jpeg) — measure mode active

## Changelog
- **2026-08-21** — Reset `opMenuOpen` when OP selector unmounts (single-op swap).
- **2026-08-21** — OP menu: `useId` + menu ref for focus; restore trigger focus on Escape/select.
- **2026-08-21** — OP selector trigger shows selected operator label (not fixed OP算子).
- **2026-08-20** — OP selector trigger type: 18px / weight 700 / line-height 26px.
- **2026-08-20** — Corner blue wash moved to ProfilingReport root (208×60); chrome strip back to flat `--pr-bg-deep`.
- **2026-08-20** — OP selector matches sketch: text+chevron (no pill), OP算子 brand trigger, mild navy chrome gradient; crops + PR-TOOLBAR-015.
- **2026-08-20** — OP selector at strip far-left for multi-operator packs; PR-TOOLBAR-013/014.
- **2026-08-20** — Depth came back to 显示控制 as PR-TOOLBAR-011: it scopes the swimlane graph, not the selection, so it belongs with the other view-wide settings. Only direction stayed in the dock.
- **2026-08-20** — Dependency display and depth left 显示控制 for the detail dock's Relevent toolbar, where the selection they filter already lives; PR-TOOLBAR-011/012 dropped with them.
- **2026-08-18** — Depth input clamps to `MAX_DEPENDENCY_DEPTH` (100); `max` attribute set on `<input>`.
- **2026-08-17** — Depth tooltip notes 10 000-link-per-side cap.
- **2026-08-17** — Dependency depth number field in 显示控制 (default 1, −1 no hop cap); PR-TOOLBAR-012.
- **2026-08-14** — Dependency display dropdown in 显示控制 (all / predecessors / successors); PR-TOOLBAR-011.
- **2026-08-12** — Measure icon = open stroke chevrons + gap from bars (not filled triangles); PR-TOOLBAR-007c.
- **2026-08-12** — Measure caliper toggle restored between fit and display-control; PR-TOOLBAR-007.
- **2026-08-11** — Action icon rest `#363636` / `#b3b3b3`; hover & pressed `#1e2a3e` / `#2d70e3`; radius `6px` (sketch-sampled).
- **2026-08-11** — Display-control popover tokens from sketch: panel `#363636` / radius `12px` / border `#5e5e5e`; select `#404040` / radius `6px`.
- **2026-08-11** — Time unit via layers → 显示控制 popover (not inline select); PR-TOOLBAR-005/010.
- **2026-08-11** — Strip `#1f1f1f`; zoom track filled `#ffffff` / unfilled `#1a1a1a`; toolbar main-column only.
- **2026-08-11** — Measure caliper toggle temporarily hidden from toolbar chrome.
- **2026-08-07** — Search/zoom corner radius `4px` (sketch), not capsule `14px`.
- **2026-08-07** — Visual tokens for search/zoom pills and square icon actions; PR-TOOLBAR-008.
- **2026-08-07** — Measure mode toggle (M2) on existing toolbar.
- **2026-08-05** — Initial spec.
