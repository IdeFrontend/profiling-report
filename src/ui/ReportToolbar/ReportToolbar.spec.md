# ReportToolbar

| spec-id-prefix |
|----------------|
| PR-TOOLBAR-*   |

Top toolbar with search, zoom controls, display-control popover (task display unit + dependency depth), measure (bars + Δt arrow) toggle, and aside panel toggle.

Crops: [`visual/search.png`](./visual/search.png), [`visual/zoom.png`](./visual/zoom.png), [`visual/actions.png`](./visual/actions.png), [`visual/measure-active.png`](./visual/measure-active.png), [`visual/display-control.png`](./visual/display-control.png), [`visual/op-selector.png`](./visual/op-selector.png), [`visual/op-selector-tabs.png`](./visual/op-selector-tabs.png), [`visual/op-selector-open.png`](./visual/op-selector-open.png) — provenance in [`visual/provenance.yaml`](./visual/provenance.yaml).

## Inputs

All inputs reflect current state owned by the parent: **searchQuery** drives the search input via v-model, **zoomPercent** fills the slider (log2-scaled integer: 0=fit / full span, 100=min window — same floor as Ctrl+wheel/`zoomAt`, not “1/100 of full”), **timeDisplayMode** (`'time' | 'cycles'`) selects the current display unit in the 显示控制 popover, **clockFreqMHz** (optional) shows the **CPU clocks** option when set, **dependencyDepth** sets hop count (default `1`, min `-1` = no hop cap, max `MAX_DEPENDENCY_DEPTH` = 100; walk is capped at 10 000 links per side), **asideVisible** and **asideAvailable** control toggle button state and visibility. Optional **locale** localizes button labels / `title` tooltips. Optional **title** shows in the toolbar header. Optional **measureMode** drives the caliper pressed state. Optional **operators** / **selectedOperatorId** drive the top-left OP selector (multi-operator packs only).

## Outputs

The toolbar emits user intent, not computed results. **zoom-in**, **zoom-out**, **zoom-to-fit** signal button clicks — the parent ProfilingReport computes the actual zoom. **update:zoomPercent** carries the slider value. **update:searchQuery** carries text input. **update:timeDisplayMode** carries the selected display mode (`'time'` or `'cycles'`). **update:dependencyDepth** carries the hop count. **update:asideVisible** toggles the panel. **update:measureMode** toggles measure mode. **update:selectedOperatorId** carries the chosen operator id from the OP selector.

## Behavior

**Zoom controls.** Toolbar buttons signal intent — the parent computes zoom around the viewport center. Visually, zoom is a **compound pill**: magnifying-glass− · slider · magnifying-glass+ (not separate square ± buttons).

**Search.** Pill field with stroke magnifying-glass SVG (not unicode `⌕`).

**Aside toggle.** Visible only when `asideAvailable` is true. Square icon button with panel SVG.

**Display control.** Not an inline toolbar `<select>`. A **layers** icon button (`data-testid="toggle-display-control"`) opens a floating **显示控制** popover (`data-testid="display-control"`) with two fields. **任务显示单位** (`data-testid="time-display-mode"`, `update:timeDisplayMode`) is a `<select>` of **时间（自动）** (`'time'`) and — when `clockFreqMHz != null` — **CPU 时钟周期** (`'cycles'`), per [UI-40a](../../../docs/context/decisions/interim/UI.md); the clocks option hides when no OpBasicInfo freq is present. **任务连接层级** (`data-testid="dependency-depth"`, `update:dependencyDepth`) sets how many hops the swimlane dependency graph walks, `-1` for the whole chain, normalized through `normalizeDependencyDepth` so a cleared field yields the shared default rather than `NaN`; it commits on `change`, not per keystroke — a half-typed number must not rebuild the graph. Close via the **X**, a second press of the layers button, a pointerdown anywhere outside the wrap (trigger + panel), or **Escape**. In `'time'` mode wall-time units auto-scale from viewport span and overview axis density (no manual ms/µs/ns dropdown). Dependency *direction* is not here: it filters what the selected event shows, so it lives in the detail dock's [Relevent](../DetailPanel/DetailRelevant/DetailRelevant.spec.md) toolbar.

**Stepper.** The field carries its own ±1 buttons, inset at its right edge. Chrome's native spinner is not usable here — `appearance: none` does not remove it, it renders as a light-mode block on the dark field, and it takes no styling — so the pair is ours: two half-height buttons behind a hairline, in the same hover and active tints as the operator menu's rows. Both go through `normalizeDependencyDepth`, so a step cannot leave the range that typing cannot, and each disables on reaching its clamp (`MIN_DEPENDENCY_DEPTH` / `MAX_DEPENDENCY_DEPTH`) rather than silently no-opping. They are `aria-hidden` and out of the tab order on purpose: a number input already steps on ArrowUp / ArrowDown, so exposing them would announce a second copy of a control assistive tech can already reach. There is no press-and-hold repeat; the useful values are small and the rest is faster to type.

**Measure (M2).** A measure icon button between zoom-to-fit and display-control toggles measure mode. The button reflects the `measureMode` prop via `aria-pressed` and the `--on` class (shared with the other active action-icon states) and emits `update:measureMode` with the new boolean on click.

**Measure icon geometry (`visual/measure-active.png`).** Two vertical bars with a horizontal double-headed Δt arrow between them, supplied as the HDesign asset `icons/measure.svg`. The hand-drawn approximation this replaced is gone, and with it the constraints that policed it (open stroke chevrons, ~1px tip gap) — the asset is now the reference, not a set of rules for redrawing one.

**OP selector (multi-operator packs).** Rendered at the far left of the tab strip (replacing the brand) when `operators` has more than one entry. Sketch ([`visual/op-selector.png`](./visual/op-selector.png), [`visual/op-selector-open.png`](./visual/op-selector-open.png)): **text + thin chevron only** — no pill fill, no vertical divider. Trigger label shows the **selected operator** label (e.g. `op1` / `op2`); menu lists all operators. Chevron points down when closed, up when open. Selecting a menu item emits `update:selectedOperatorId` and closes the menu (re-selecting the active id does not emit). Keyboard: ArrowDown/Enter/Space open; Escape closes; ArrowUp/Down move; Enter/Space select. With zero or one operator, the static brand (`title` / OP算子) is shown instead.

**Zoom-to-fit.** Square icon button (fit/frame glyph), not a text label — keep accessible `title` via i18n.

**Shortcut help (PyPTO parity).** A **keyboard** glyph button sits **first** in the action-icon list — immediately after the zoom pill, before zoom-to-fit / measure / display-control / aside. It opens a floating **快捷键说明** popover (`data-testid="shortcut-help"`) mirroring PyPTO's `swimGraphShortCutKeyDescripiton` panel: **450px** card, **16px** radius; **鼠标操作** and **键盘操作** side-by-side (mouse: vertical movement = wheel glyph, single/box selection = left-click glyph; keyboard: zoom W|S and pan A|D as horizontal pairs); **组合操作** full-width below (scaling = wheel+Ctrl; pan = left-click+Ctrl; box select = left-click; time measurement = left-click+Alt). Bindings render as PyPTO 24×24 multi-color SVG glyphs (`img[data-shortcut-icon]`) — not text `<kbd>` keycaps. Trackpad/gesture alternatives are omitted (unsupported here). The panel is **teleported to `body`** with `position: fixed` (right-aligned under the trigger, clamped into the viewport) so toolbar `overflow-x: clip` cannot crop it. The panel closes via the X, a second press of the trigger, a pointerdown outside the wrap (trigger + panel), or **Escape** — the same dismiss contract as 显示控制. The `help` icon remains reserved for the connection-level tooltip; the shortcut action uses a distinct `keyboard` glyph.

## Visual

Source band ~y=400–472 in [`source/v930/entry.jpeg`](../../../docs/ui/source/v930/entry.jpeg) (device px @ dump resolution). Control height **~28–29 px** CSS. Chrome strip is **min-height 60px** on one row; when tabs + toolbar no longer fit side-by-side the **whole** `.pr-toolbar` (search, zoom, actions) wraps to a second row together and the corner wash stretches with the taller chrome. If the second row is still too narrow, trailing icon actions crop (`overflow-x: clip`) while search and zoom stay visible; cropped trailing controls are marked `inert` so they leave the tab order.

Lives in the **main** column only (above the timeline), not spanning the StatsAside — see [ReportLayout](../ReportLayout/ReportLayout.spec.md).

### Strip

| Token | Value |
|-------|--------|
| Height | `min-height: 60px` (`box-sizing: border-box`, includes bottom border); grows when the whole toolbar wraps to a second row |
| Padding | `8px` — vertical inset so a wrapped toolbar row is not flush with the tabs above or the axis below |
| Narrow host | Chrome `flex-wrap: wrap`; toolbar stays `nowrap` so search/zoom/actions jump together; second-row overflow uses `overflow-x: clip` (crop trailing icons, keep search/zoom); clipped trailing actions get `inert` |
| Background | `#1f1f1f` (`--pr-bg-deep`) |
| Border | `1px solid #3a3a3a` bottom |
| Corner wash | 208px-wide top-left blue fade, `top: 0; bottom: 0` so it fills the full chrome height (including a wrapped second row): `radial-gradient(59% 100.4% at 41% 0%, rgba(44,41,175,0.2) 0%, rgba(0,0,0,0) 100%)` over `linear-gradient(90deg, rgba(0,90,219,0.1) 3.614%, rgba(0,2,172,0) 76.501%)`; `pointer-events: none`. Radial horizontal radius is **59%** so the transparent stop lands on the box’s right edge (Figma’s `150.89%` left residual α at the clip → hard seam into `#1f1f1f`) |

### OP selector (`visual/op-selector.png`, `visual/op-selector-open.png`)

Source: [`v930/entry`](../../../docs/ui/source/v930/entry.jpeg) (closed), [`v930/hardware-more-detail`](../../../docs/ui/source/v930/hardware-more-detail.jpeg) (open). Context: [`visual/op-selector-tabs.png`](./visual/op-selector-tabs.png).

| Token | Value |
|-------|--------|
| Trigger | Transparent — **no** pill fill, **no** border, **no** vertical divider |
| Trigger label | Selected operator label (e.g. `op1`) — white, 18px / weight 700 / line-height 26px / letter-spacing 0 |
| Chevron | Thin stroke `10×10`, color `#c8c8c8`; down when closed, rotated 180° when open |
| Gap label↔chevron | `4px` |
| Menu bg | `#363636` (`--pr-surface-raised`) |
| Menu radius | `8px` |
| Menu border | none |
| Item radius | `4px` |
| Item text | `#d0d0d0` / 12px; hover `#ffffff` on `rgba(255,255,255,0.1)`; active `#ffffff` on `rgba(49,122,247,0.2)`. Hover must **lighten** against the menu, never darken |
| Visible when | `operators.length > 1` |

### Search (`visual/search.png`)

| Token | Value |
|-------|--------|
| Height | `28px` |
| Width | `190px` |
| Shape | Rounded rect: `border-radius: 4px` (not capsule) |
| Background | `#2a2a2a` |
| Border | none (or `1px solid #3a3a3a` if needed) |
| Icon | `search` design icon `16×16`, color `#9a9a9a`, left inset |
| Input padding | `0 12px 0 32px` |
| Placeholder | `#808080`; text `#e0e0e0`; font `12px` |

### Zoom pill (`visual/zoom.png`)

| Token | Value |
|-------|--------|
| Container | Single control, height `28px`, `border-radius: 4px`, bg `#363636` |
| Zoom out / in | `zoom-out` / `zoom-in` design icons — magnifying glass with − / + inside (not bare ± text); `16×16`, color `#c8c8c8` |
| Buttons | Transparent, no separate square border; padding `4px 6px` |
| Slider | Width ~`100px`; track height `2px`; filled (left) `#ffffff`; unfilled `#1a1a1a`; thumb `10px` circle `#c8c8c8` |
| Gap | `4px` between icon / slider / icon inside pill |

### Action icon buttons (`visual/actions.png`)

Resting fill from `v930/entry` actions strip; hover/pressed from `v930/hardware-more-detail` (layers under cursor + active chart).

| Token | Value |
|-------|--------|
| Size | Square `28×28`; glyph `16×16` |
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
| Trigger | `display-config` design icon (stacked layers); `aria-expanded`; `--on` when open |
| Panel bg | `#363636` |
| Panel border | `1px solid #5e5e5e` |
| Panel radius | `12px` |
| Panel padding | `20px 22px 22px` |
| Shadow | soft `0 6px 20px rgba(0,0,0,0.55)` |
| Title | `13px` / `600` / `#ffffff` |
| Close | `close` design icon, `#b3b3b3` |
| Section label | `12px` / `#b2b2b2` |
| Help | `help` design icon as a `<button type="button">` (so clicks do not activate the depth field label); tip referenced via `aria-describedby`; hover/focus bubble on `--pr-surface-raised`, `11px` / `#e6e6e6`, above the icon |
| Time unit select | `#404040` bg, radius `6px`, height `32px`, text `#ffffff`, `appearance: none` |
| Time unit chevron | Down triangle on the select's right (`right: 12px`), `#b3b3b3`, `pointer-events: none` so clicks reach the field |
| Depth input bg | `#404040` |
| Depth input radius | `6px` |
| Depth input height | `32px`; text `#ffffff`; `40px` right padding to clear the stepper |
| Stepper | Two `28px` half-height buttons inset at the field's right edge; `1px rgba(255,255,255,0.08)` hairline down the left and between them; outer corners follow the field at `5px` |
| Stepper chevrons | Shared [`Chevron`](../Chevron.vue) at `direction="up"` / `"down"`, `#b3b3b3` |
| Stepper hover / active | `rgba(255,255,255,0.1)` / `rgba(49,122,247,0.2)` with `--pr-text-accent` — the operator menu's two tints (AC-21.3) |
| Stepper at a clamp | `disabled`, `#5e5e5e`, `cursor: default` |

### Icons

Rendered by [`PrIcon`](../PrIcon.vue) as CSS-masked spans, so the button tints one asset through
`currentColor` across rest / hover / active instead of shipping a glyph per state. Assets live in
[`src/ui/icons/`](../icons); the HDesign originals stay in
[`docs/ui/review/icons/`](../../../docs/ui/review/icons) as provenance.

The exports carry Figma's invisible bookkeeping — duplicate copies of each path at
`fill-opacity="0"` or `stroke-opacity="0"`, plus a full-bleed frame rect. Those are stripped on
import (`zoom-in` alone went 9.7 kB → 0.5 kB) because anything over Vite's 4 kB
`assetsInlineLimit` is emitted as a separate file, which a consumer of the library bundle would
not serve.

| Name | Source export | Used by |
|------|---------------|---------|
| `search` | `操作图标-搜索(search-new).svg` | Search field (AC-02) |
| `zoom-in` / `zoom-out` | `ic_public_zoom_in.svg` / `ic_public_zoom_out1.svg` | Zoom pill (AC-03) |
| `stats` | `性能统计.svg` | Aside toggle (AC-04) |
| `measure` | `measure_icon.svg` | Measure toggle |
| `display-config` | `泳道图显示配置.svg` | 显示控制 trigger |
| `help` | `帮助.svg` | 任务连接层级 help (AC-20.2) |
| `close` | `ic_public_close.svg` | 显示控制 close (AC-20.5) |
| `keyboard` | `icon.svg` | 快捷键说明 trigger (PR-TOOLBAR-021) |

Zoom-to-fit keeps its hand-drawn frame glyph — no design export was supplied for it.

### Full strip (`visual/toolbar.png`)

Composite of search + zoom + actions at chrome height for layout spacing.

## Acceptance Criteria

1. **PR-TOOLBAR-001** — Emits update:searchQuery on text input.
2. **PR-TOOLBAR-002** — Emits zoom-in on button click.
3. **PR-TOOLBAR-003** — Emits `zoom-out` on button click.
4. **PR-TOOLBAR-004** — Emits `zoom-to-fit` on button click.
5. **PR-TOOLBAR-005** — Layers button opens 显示控制 with a `time-display-mode` select and a `dependency-depth` field; the popover is not visible until open; the select emits `update:timeDisplayMode`.
6. **PR-TOOLBAR-006** — Emits `update:asideVisible` on toggle.
7. **PR-TOOLBAR-007** — Measure toggle (`toggle-measure`) renders the `measure` icon (`data-testid="measure-icon"`); emits `update:measureMode` on click.
8. **PR-TOOLBAR-007b** — Active measure toggle uses `aria-pressed="true"` and `--on`.
9. **PR-TOOLBAR-007c** — *WITHDRAWN (2026-09-01)* — policed the arrowhead geometry of the hand-drawn measure glyph, which the HDesign asset replaced.
10. **PR-TOOLBAR-008** — Search exposes a magnifier icon (`data-testid="search-magnifier"`); zoom root uses compound pill class; zoom ± are icon buttons (not bare text-only ± outside a pill).
11. **PR-TOOLBAR-009** — Strip uses `--pr-bg-deep`; search `#2a2a2a`; zoom pill `#363636`; zoom track filled `#ffffff` / unfilled `#1a1a1a`. `.pr-chrome` is `min-height: 60px` with `flex-wrap: wrap` and `padding: 8px` so the whole `.pr-toolbar` (search + zoom + actions, itself `nowrap`) jumps to a second row together when it no longer fits beside the tabs, with vertical inset so the wrapped row is not flush with the tabs or the axis; `overflow-x: clip` then crops trailing icon actions if the second row is still too narrow. Search and zoom stay visible.
12. **PR-TOOLBAR-010** — Display-control popover closes via X, toggling the layers button, a pointerdown outside the wrap (trigger + panel), or Escape.
13. **PR-TOOLBAR-011** — 显示控制 carries the dependency depth field; emits normalized on change.
14. **PR-TOOLBAR-013** — OP selector renders for multiple operators; trigger shows selected operator label; menu lists operators; selecting emits `update:selectedOperatorId`; Escape/Enter/Arrow supported; re-select does not emit; open state clears when selector unmounts.
15. **PR-TOOLBAR-014** — OP selector hidden for zero or one operator (brand shown).
16. **PR-TOOLBAR-015** — OP selector is text+chevron (transparent, no pill/divider); trigger type is 18px / 700 / 26px lh.
17. **PR-TOOLBAR-016** — Design icons render as `PrIcon` masked spans tinted by `currentColor`, so one asset serves both rest and active states; `16×16`.
18. **PR-TOOLBAR-017** — The 任务连接层级 help control is a `<button type="button">` with a CSS hover/focus bubble (`data-testid="connection-level-help"`), not a native `title`. The tip has `role="tooltip"` and is linked from the button via `aria-describedby`; the button's `aria-label` is the short `helpConnectionLevel` name (distinct from the tip's `connectionLevelHelp` text) so AT does not announce the explanation twice.
19. **PR-TOOLBAR-018** — The corner wash is the strip's first child, painting above the strip background and below the tabs, pinned with `top: 0; bottom: 0` so it fills the full `.pr-chrome` height (including when the toolbar wraps). Radial horizontal radius is **59%** so opacity reaches 0 at the 208px right edge (no hard seam into `#1f1f1f`). `.pr-chrome` is `position: relative` with **no** `z-index` or `isolation`: a stacking context there would trap the OP menu and 显示控制 popover inside the strip. `.pr-tabs` is positioned so labels paint over the wash.
20. **PR-TOOLBAR-019** — The depth field's own stepper buttons emit `update:dependencyDepth` ±1 through `normalizeDependencyDepth`, disable at each clamp, and stay out of the tab order and the accessibility tree.
21. **PR-TOOLBAR-020** — Trailing toolbar icon actions (`zoom-to-fit`, measure, display-control, aside) carry `data-toolbar-clip`; when `overflow-x: clip` crops them past the toolbar's right edge they receive `inert` so keyboard focus cannot land on an invisible control. Search and zoom are never marked.
22. **PR-TOOLBAR-021** — The shortcut-help action renders **first** in the action list (immediately after the zoom pill, before `zoom-to-fit`), using the `keyboard` glyph (`data-testid="toggle-shortcuts"`, `data-toolbar-clip`).
23. **PR-TOOLBAR-022** — Clicking the shortcut-help trigger opens the `shortcut-help` popover listing mouse / keyboard / combined bindings (W/S/A/D, Ctrl+wheel, Ctrl+drag, Alt+click); it closes via the X, a second press, an outside pointerdown, or Escape.
24. **PR-TOOLBAR-023** — The popover renders bindings as PyPTO 24×24 SVG glyphs (`img[data-shortcut-icon]` for W/S/A/D, mouse wheel/click, Ctrl, Alt) and labels all sections through i18n (`shortcuts` / `mouseControl` / `keyboardControl` / `combinedControl`). Layout is Mouse‖Keyboard side-by-side with Combined full-width below.

## Edge Cases

- asideAvailable=false → toggle button hidden.
- Search query initially empty, user types to filter.
- Popover closed → `display-control` not in DOM (or not visible).

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
- **2026-09-04** — Shortcut-help popover teleports to `body` (fixed) so toolbar `overflow-x: clip` cannot crop the 450px card.
- **2026-09-04** — Shortcut-help popover matches PyPTO layout (Mouse‖Keyboard + Combined) and 24×24 SVG glyphs (`PR-TOOLBAR-023`).
- **2026-09-03** — Shortcut-help action (`keyboard` glyph, first in the action list) + 快捷键说明 popover (`PR-TOOLBAR-021` / `022` / `023`).
- **2026-09-03** — Chrome `padding: 8px` so a wrapped toolbar row is not flush with the tabs or the axis (`PR-TOOLBAR-009`).
- **2026-09-03** — Display-control closes on Escape (`PR-TOOLBAR-010`); clipped trailing icon actions get `inert` so they leave the tab order (`PR-TOOLBAR-020`).
- **2026-09-02** — Whole toolbar wraps to a second row together; wash stretches with `top/bottom: 0`; second-row overflow still crops trailing icons (`PR-TOOLBAR-009` / `018`).
- **2026-09-02** — Chrome stays one row on narrow hosts: `nowrap` + `overflow-x: clip`; trailing icon actions crop, search/zoom stay (`PR-TOOLBAR-009`). *(Superseded — whole-toolbar wrap restored; see above.)*
- **2026-09-02** — Corner wash radial horizontal radius `150.89%` → `59%` so the fade completes inside the 208px box (no hard seam into `#1f1f1f`; PR-TOOLBAR-018).
- **2026-09-02** — Chrome strip uses `min-height: 60px` (not fixed `height`) so a wrapped action row is not cropped (`PR-TOOLBAR-009`).
- **2026-09-02** — Chrome strip (OP selector + tabs + actions) single-row band is `60px` (`PR-TOOLBAR-009`).
- **2026-09-02** — PR-TOOLBAR-017: help control becomes a real `<button>` with `aria-describedby` on the tip (was a focusable `generic` span whose `aria-label` browsers ignore). PR-TOOLBAR-018: wash height is `100%` of the strip rather than a fixed 60px that spilled under `.pr-main`.
- **2026-09-01** — PR-TOOLBAR-010: a pointerdown outside the wrap (trigger + panel) dismisses 显示控制 immediately, matching the usual popover expectation. Previously only the X and a second press of the layers button closed it.
- **2026-09-01** — PR-TOOLBAR-019: the depth field gets a custom stepper. AC-20.6 dropped Chrome's native spinner because it renders as a light-mode block on the dark field; the field was then left with no step affordance at all, which Product asked to restore. `Chevron` gains a `direction` prop so the pair reuses the existing glyph, and `MIN_DEPENDENCY_DEPTH` replaces the `-1` literal that the clamp, the markup and the disabled state would otherwise each repeat.
- **2026-09-01** — Corner wash moved here from the report root, where `.pr-main` covered it (PR-TOOLBAR-018; PR-ROOT-006 withdrawn).
- **2026-09-01** — HDesign icons for search / zoom / stats / measure / 显示控制 / help / close via `PrIcon` masks at `16×16`; help gains a CSS hover bubble (PR-TOOLBAR-016/017). PR-TOOLBAR-007c withdrawn with the hand-drawn measure glyph.
- **2026-09-02** — Added 任务显示单位 (Time auto vs CPU clocks) dropdown to 显示控制, gated on `clockFreqMHz`; PR-TOOLBAR-005 restated for `time-display-mode`.
- **2026-08-27** — Removed manual time-unit dropdown from 显示控制; wall-time labels auto-scale per UI-40a; PR-TOOLBAR-005 restated.
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
