# LaneGutter

| spec-id-prefix |
|----------------|
| PR-GUTTER-*    |

Left-side vertical gutter showing Card / nested lane hierarchy, lane names, and utilization percentages. Scroll-synced with the swimlane canvas so lane labels align with event rows.

Crops: [`visual/expanders.png`](./visual/expanders.png), [`visual/expander-detail.png`](./visual/expander-detail.png), [`visual/gutter-util.png`](./visual/gutter-util.png), [`visual/util-bars.png`](./visual/util-bars.png), [`visual/util-midline.png`](./visual/util-midline.png), [`visual/util-midline-detail.png`](./visual/util-midline-detail.png), [`visual/pin-lanes.png`](./visual/pin-lanes.png), [`visual/pin-icon-detail.png`](./visual/pin-icon-detail.png), [`visual/pin-hover-tooltip.png`](./visual/pin-hover-tooltip.png) — provenance in [`visual/provenance.yaml`](./visual/provenance.yaml).

## Inputs

**groups** is an array of Card groups `{ id, name, lanes }` where each lane is a recursive node `{ id, name, color, utilization?, children?, categoryKey? }`.

- **Card** (`SwimProcess`) → group header only.
- **Nested folder** (`children` non-empty) → lane-style row with chevron + util; no canvas events.
- **Leaf** (no children) → lane row; util optional.
- **`categoryKey`** (`comm` \| `compute` \| `hbm`) — when set, gutter shows the localized label (`t(lane*)`) instead of raw `name`.

Parent builds this from `SwimlaneModel`, assigning colors via `colorVarForLaneName` and reading `utilization` / `categoryKey` from each node. Flat CTEF (no `children`) still works as Card → leaf lanes.

**collapsedIds** (optional `string[]`) — ids of Cards or nested folders whose **descendants** are hidden (the collapsed node row itself stays visible for nested folders; collapsing a Card hides all its lanes). Parent owns collapse so the canvas mirrors the visible row set (`displaySwim`).

**pinnedLaneIds** (optional `string[]`, read-only) — ids of **leaf** lanes currently pinned. Parent owns pin order; gutter uses this to render filled vs outline pushpin state on originals. Pinned duplicates render in `SwimlaneView`'s sticky strip (see [`SwimlaneView.spec.md`](../SwimlaneView.spec.md)).

## Outputs

**scroll** fires when the user scrolls the gutter. The parent reads the gutter's `scrollTop` and propagates it as `scrollY` to the swimlane canvas. The element is exposed via `defineExpose` for imperative scroll sync in the reverse direction.

**toggle-group** fires with a **folder** node `id` when the user clicks a folder row. **Card** expand/collapse is emitted by `SwimlaneView` Card strips (not this gutter). Parent toggles that id in `collapsedIds`.

**pin-lane** fires with a **leaf** lane `id` when the user clicks an unpinned pushpin. **unpin-lane** fires with the same shape when the user clicks a pinned pushpin on an original row. Parent updates `pinnedLaneIds` immutably (see [`view-state.spec.md`](../../../../../specs/core/view-state.spec.md)).

## Behavior

### Hierarchy + expanders

| Element | Visual (normative) |
|---------|-------------------|
| Card chrome | Owned by `SwimlaneView` full-width strips: open-angle caret (`#a8a8a8`, 10×10), label `14px` / `700` / `22px` line-height / `#e6e6e6`, fill `rgb(42, 42, 42)`, row `40px`. Gutter contributes only a transparent **40px spacer**. |
| Nested folder chevron | Open-angle stroke caret on lane-style rows that have `children`. Expanded = **down**; collapsed = **right**. Color `#a8a8a8`. Layout box `10×10`, stroke ~1.2px. |
| Leaf chevron | **Omitted**. |
| Lane / folder label | `11px` / weight `400` / `#b0b0b0`; row height `22px` (`LANE_HEIGHT`); truncated with ellipsis. |
| Indent | Depth 0 under Card: pad-left `24px` (= group pad `8` + chev `10` + gap `6`). Each nested level adds `14px`. |
| Separators | `1px` rule under Card spacer and under each lane/folder (`#3a3a3a` / `#333`). |
| Gutter surface | Lane rows `#1f1f1f` (`--pr-bg-deep`). Lane rows keep the gutter `1px solid #3a3a3a` right border. |

Clicking a **folder** lane toggles expand/collapse (`aria-expanded`). Card toggle is on the SwimlaneView strip. Collapse hides descendants; parent syncs canvas row heights.

### Utilization

Each lane **and folder** row optionally shows a utilization bar with the percentage **inside, right-aligned**. See **Visual** below.

### Pin (leaves and nested folders)

Pushpin control on **leaf and nested folder** rows — not on Card spacers. Click toggles pin state via `pin-lane` / `unpin-lane`. Pinning a folder duplicates the folder **plus descendants** in the sticky strip (see [`SwimlaneView.spec.md`](../SwimlaneView.spec.md)). Originals stay in tree order below.

| Element | Visual (normative) |
|---------|-------------------|
| Pin control | Absolute at gutter **left edge** (`left ≈ 6px`); **not** depth-indented. Layout box **16×16** |
| Visibility | **Pinned:** always visible (filled). **Unpinned:** hover only — leaf gutter row, or pin `:focus-visible` (not events-chart hover) |
| Unpinned (lane hover) | **Outline** pushpin; stroke `#a8a8a8` (chevron family) |
| Pinned / pin hover | **Solid fill** accent blue `#4a90e2` (match toolbar measure-active) |
| Tooltip | Localized **置顶** / **Pin to top** (`t('pin')`) on hover/focus over pushpin; EventTooltip chrome — `--pr-surface-raised` (`#363636`), `1px solid rgba(255,255,255,0.05)`, `0 0 16px rgba(0,0,0,0.2)`, radius `8px` |
| Row hover | Full gutter row highlight `--pr-surface-raised` (`#363636`) when pointer over the leaf gutter row **or** that leaf’s events-chart band (`hoveredLaneId`), and the label lifts to `#fff`; the canvas paints the track half to match. Canvas band hover does **not** reveal the unpinned pushpin |
| Accessibility | Focusable `button`; `aria-label` **置顶**; pinned state reflected in `aria-pressed` |

**Indent:** leaf and folder pad-left stay **`24px + depth×14px`** (pin does not add a column). Pin sits in the left margin to the left of chevrons/names at every depth.

## Visual

### Util bars (`visual/gutter-util.png`, `visual/util-bars.png`, `visual/util-midline.png`, `visual/util-midline-detail.png`)

| Token | Value |
|-------|--------|
| Track width | `110px` (fixed column) |
| Thick height | `16px` — folders and depth-0 leaves (`通信`, `储存HBM`, `计算`, `CoreN.*`) |
| Thin height | `8px` — pipe leaves under Core (`ALL`, `SCALAR`, `MTE*`, …) |
| Shape | Rounded rect, radius by bar height: **4px** on the 16px thick bar, **2px** on the 8px thin one. Never a full capsule / `height/2` — 4px on an 8px bar rounds the ends into a stadium |
| Track / unfilled | Gray **diagonal hatch** — repeating `-45deg` stripes `#3a3a3a` on `--pr-util-track` (`#2a2a2a`) |
| Value fill | **Two colors only:** util &lt; 0.5 → `rgba(231,67,74,0.4)` (red); util ≥ 0.5 → `rgba(255,255,255,0.08)` (gray). Do **not** use pipe/category `lane.color`. Composited over an opaque `--pr-util-track` base so the filled portion is **solid** and the hatch stops at the filled edge, marking only what is left to fill |
| 50% midline | `1px dashed rgba(255,255,255,0.1)` at `left: 50%` of track (full height); above fill, under % text; omit on empty util slots |
| % text | **Thick bars only**, inside track, right-aligned, `padding-right: 6px`. **Thin bars omit %** |
| % font | 10px, weight 600, tabular-nums, color **`#b0b0b0`** (same as lane title — not bright white) |
| Layout | `grid-template-columns: minmax(0,1fr) 110px` (name + util) |

**Do not** place `%` to the left of the bar. Flat CTEF (all depth-0 leaves) uses thick bars only.

### Expanders (`visual/expanders.png`, `visual/expander-detail.png`)

| Token | Value |
|-------|--------|
| Icon style | **Open-angle** stroke chevron (CSS borders), not filled `▾`/`▸` |
| Expanded | Down-pointing caret (`v`), color `#a8a8a8` |
| Collapsed | Right-pointing caret |
| Nested folders | Chevron on lane-style rows with children |
| Leaf lanes | No expander chevron |
| Interaction | Folder row click → `toggle-group`. **Card** expand/collapse is owned by `SwimlaneView` Card strips (not the gutter spacer). |

### Pin pushpin (`visual/pin-lanes.png`, `visual/pin-icon-detail.png`, `visual/pin-hover-tooltip.png`)

Source: `v930/hardware-more-detail` (Core2.Cube expanded gutter). See [`visual/provenance.yaml`](./visual/provenance.yaml).

| Token | Value |
|-------|--------|
| Icon | PyPTO / DevUI pushpin thumbtack (`src/ui/icons/pushpin.svg` outline, `pushpin-fill.svg` solid) |
| Layout box | `16×16` (PyPTO DevUI pushpin native size) |
| Position | Flush **left** of gutter row (absolute); same x at every nest depth |
| Visibility | Unpinned: only while leaf gutter row hovered (or pin focused). **Pinned: always visible** (original + sticky strip) |
| Unpinned | Outline stroke `#a8a8a8` |
| Pinned / pin hover | Solid fill `#4a90e2` |
| Tooltip | **置顶** |
| Row hover | `#363636` on full gutter leaf row, label to `#fff` |

## Acceptance Criteria

1. **PR-GUTTER-001** — Renders lane names for each group (including nested when expanded).
2. **PR-GUTTER-002** — Shows utilization percent **inside** the util bar (right-aligned) on leaves and folders when set.
3. **PR-GUTTER-003** — Nested folders show open-angle carets; leaf lanes have **no** chevron; folder click emits `toggle-group` with node id. Card expand UI lives on SwimlaneView strips (gutter Card is a spacer).
4. **PR-GUTTER-004** — When a Card id is in `collapsedIds`, child lanes are hidden. When a nested folder id is collapsed, its descendants are hidden but the folder row remains.
5. **PR-GUTTER-005** — Nested indent increases with depth; only Card uses group-header spacer chrome.
6. **PR-GUTTER-006** — Util fills are red (`rgba(231,67,74,0.4)`) when util &lt; 0.5 and gray (`rgba(255,255,255,0.08)`) when ≥ 0.5; never pipe-category colors. Thick class on folders/depth-0; thin on deeper leaves. Thin bars omit the % label. The fill sits on an opaque `--pr-util-track` base (solid, unhatched), and the thin bar's radius is 2px against the thick bar's 4px.
7. **PR-GUTTER-007** — Filled util tracks show a vertical `1px dashed rgba(255,255,255,0.1)` midline at 50% width; empty util slots do not.
8. **PR-GUTTER-008** — Card row is a non-interactive 40px spacer (`data-testid` `gutter-group-*`); no Card toggle button in the gutter.
9. **PR-GUTTER-010** — Leaf **and folder** rows include a pushpin control (DOM); **Card** rows omit pin. Unpinned pin hidden until gutter hover (or focus); **pinned pin always visible**. Does **not** appear from events-chart hover.
10. **PR-GUTTER-011** — Unpinned outline `#a8a8a8` on lane hover; pinned/pin-hover solid `#4a90e2`. Pin stays flush-left (not depth-indented).
11. **PR-GUTTER-012** — Pushpin hover/focus shows localized pin tooltip (`置顶` / `Pin to top`).
12. **PR-GUTTER-013** — Click unpinned pin emits `pin-lane`; pinned emits `unpin-lane`.
13. **PR-GUTTER-014** — When `categoryKey` is set, gutter labels follow `locale` (`通信`/`Comm`, `计算`/`Compute`, `储存HBM`/`HBM storage`).
14. **PR-GUTTER-015** — A hovered lane row (pointer or `hoveredLaneId`) fills `--pr-surface-raised` and lifts its label to `#fff`; the pin tooltip carries EventTooltip chrome.
15. **PR-GUTTER-016** — Folder pin click emits `pin-lane` / `unpin-lane` and does **not** emit `toggle-group`.

## Edge Cases

| State | Behavior |
|---|---|
| Empty groups array | Empty gutter |
| Groups with zero lanes | Card spacer rendered, no lane rows |
| Standalone CTEF (no pipe data) | All lanes show empty util slot (no %) |
| Flat CTEF (no `children`) | Card → leaf lanes only (MVP-compatible) |
| Very long thread names | CSS text-overflow truncation |
| Scroll position mismatch | Bidirectional sync corrects |
| Pin leaf inside collapsed folder | Original pin control hidden while ancestor collapsed; **pinned strip duplicate stays** (id remains in **pinnedLaneIds**) |
| Pin across Cards | Pushpin on any visible leaf regardless of Card/process ancestry |
| Duplicate pin click | Idempotent — no duplicate entries in `pinnedLaneIds` |
| Events chart hover | Matching gutter leaf gets `#363636` and a `#fff` label via `hoveredLaneId`; unpinned pushpin stays hidden. The canvas paints the same `#363636` across the track half of that row (`setHoveredLane`, behind events) |

## Design sketches

- [expanders](./visual/expanders.png) — from `v930/entry`
- [expander-detail](./visual/expander-detail.png) — from `v930/entry`
- [gutter-util](./visual/gutter-util.png) — from `v930/entry`
- [util-bars](./visual/util-bars.png) — from `v930/entry`
- [util-midline](./visual/util-midline.png) — from `v930/entry`
- [util-midline-detail](./visual/util-midline-detail.png) — from `v930/entry`
- [pin-lanes](./visual/pin-lanes.png) — from `v930/hardware-more-detail`
- [pin-icon-detail](./visual/pin-icon-detail.png) — from `v930/hardware-more-detail`
- [pin-hover-tooltip](./visual/pin-hover-tooltip.png) — from `v930/hardware-more-detail`
- [hardware-more-detail](../../../../../docs/ui/source/v930/hardware-more-detail.jpeg) — full frame (Core2.Cube expanded)

## Changelog
- **2026-09-03** — Folders are pinnable (`PR-GUTTER-010`/`016`); Card spacers still omit pin. Folder row is a `div` so the pin can be a nested button.
- **2026-09-01** — PR-GUTTER-015: row hover moves `#252525` → `--pr-surface-raised` (`#363636`) and lifts the label to `#fff`. Both UCD crops (AC-07, AC-19) measure `#363636`, and AC-19 calls out the label change the pin slice did not implement. The pin tooltip's chrome was specified as "EventTooltip chrome: `#2a2a2a` / `#555`", which AC-09 moved out from under it; it now names the raised-surface values directly. (Numbered 015 so master's `categoryKey` keeps `PR-GUTTER-014`.)
- **2026-09-01** — Card strip 40px with `14px` / `700` / `22px` / `#e6e6e6` label (AC-17); gutter spacer and `LANE_GROUP_HEADER_HEIGHT` follow.
- **2026-09-01** — `categoryKey` localizes card category labels (`PR-GUTTER-014`); see [LOCALIZATION.md](../../../../../docs/ui/LOCALIZATION.md).
- **2026-08-31** — Events-chart leaf hover highlights matching gutter row `#252525` via `hoveredLaneId`; unpinned pushpin still gutter-only.
- **2026-08-28** — Unpinned pushpin: gutter hover only (not events-chart). Row highlight later restored for chart→header hint.
- **2026-08-28** — Pin glyph: PyPTO/DevUI `pushpin` / `pushpin-fill` SVG assets under `src/ui/icons/`.
- **2026-08-28** — Pinned pushpin stays visible on original + sticky strip; unpinned remains hover-only.
- **2026-08-28** — Pin hover-only, flush-left (no depth indent); row `#252525` on gutter hover; leaf indent unchanged (`24 + depth×14`).
- **2026-08-27** — Renumber pin ACs to `PR-GUTTER-010`…`013` (reserve `009` for #45 gutter-metrics).
- **2026-08-27** — Pin pushpin on leaf rows; crops + visual tokens from `v930/hardware-more-detail` (`PR-GUTTER-010`…`013`). Tests deferred until implementation.
- **2026-09-01** — Util bars: thin (8px) radius drops to 2px, thick (16px) keeps 4px; the fill composites over an opaque `--pr-util-track` so it reads solid and the hatch ends at the filled edge instead of running through it.
- **2026-08-21** — Util bars: 50% dashed midline (`PR-GUTTER-007`); tight midline crops. Card spacer renumbered to `PR-GUTTER-008`.
- **2026-08-13** — Card chrome moved to SwimlaneView full-width strips; gutter Card is spacer.
- **2026-08-11** — Util bars: thick/thin by depth; red/gray threshold fills only.
- **2026-08-11** — Nested Card → category → Core → pipe; Card-only group header; folder lane-rows with util.
- **2026-08-07** — Util bars inside track; open-angle carets.
