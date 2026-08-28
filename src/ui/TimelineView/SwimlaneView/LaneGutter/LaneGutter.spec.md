# LaneGutter

| spec-id-prefix |
|----------------|
| PR-GUTTER-*    |

Left-side vertical gutter showing Card / nested lane hierarchy, lane names, and utilization percentages. Scroll-synced with the swimlane canvas so lane labels align with event rows.

Crops: [`visual/expanders.png`](./visual/expanders.png), [`visual/expander-detail.png`](./visual/expander-detail.png), [`visual/gutter-util.png`](./visual/gutter-util.png), [`visual/util-bars.png`](./visual/util-bars.png), [`visual/util-midline.png`](./visual/util-midline.png), [`visual/util-midline-detail.png`](./visual/util-midline-detail.png), [`visual/pin-lanes.png`](./visual/pin-lanes.png), [`visual/pin-icon-detail.png`](./visual/pin-icon-detail.png), [`visual/pin-hover-tooltip.png`](./visual/pin-hover-tooltip.png) — provenance in [`visual/provenance.yaml`](./visual/provenance.yaml).

## Inputs

**groups** is an array of Card groups `{ id, name, lanes }` where each lane is a recursive node `{ id, name, color, utilization?, children? }`.

- **Card** (`SwimProcess`) → group header only.
- **Nested folder** (`children` non-empty) → lane-style row with chevron + util; no canvas events.
- **Leaf** (no children) → lane row; util optional.

Parent builds this from `SwimlaneModel`, assigning colors via `colorVarForLaneName` and reading `utilization` from each node. Flat CTEF (no `children`) still works as Card → leaf lanes.

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
| Card chrome | Owned by `SwimlaneView` full-width strips: open-angle caret (`#a8a8a8`, 10×10), label `12px` / `600` / `#e8e8e8`, fill `rgb(42, 42, 42)`, row `28px`. Gutter contributes only a transparent **28px spacer**. |
| Nested folder chevron | Open-angle stroke caret on lane-style rows that have `children`. Expanded = **down**; collapsed = **right**. Color `#a8a8a8`. Layout box `10×10`, stroke ~1.2px. |
| Leaf chevron | **Omitted**. |
| Lane / folder label | `11px` / weight `400` / `#b0b0b0`; row height `22px` (`LANE_HEIGHT`); truncated with ellipsis. |
| Indent | Depth 0 under Card: pad-left `24px` (= group pad `8` + chev `10` + gap `6`). Each nested level adds `14px`. |
| Separators | `1px` rule under Card spacer and under each lane/folder (`#3a3a3a` / `#333`). |
| Gutter surface | Lane rows `#1f1f1f` (`--pr-bg-deep`). Lane rows keep the gutter `1px solid #3a3a3a` right border. |

Clicking a **folder** lane toggles expand/collapse (`aria-expanded`). Card toggle is on the SwimlaneView strip. Collapse hides descendants; parent syncs canvas row heights.

### Utilization

Each lane **and folder** row optionally shows a utilization bar with the percentage **inside, right-aligned**. See **Visual** below.

### Pin (leaf lanes only)

Pushpin control on **leaf** rows only — not on nested folders or Card spacers. Click toggles pin state via `pin-lane` / `unpin-lane`. Duplicates render in the sticky pinned strip owned by `SwimlaneView`; originals stay in tree order below.

| Element | Visual (normative) |
|---------|-------------------|
| Pin control | Absolute at gutter **left edge** (`left ≈ 6px`); **not** depth-indented. Layout box **10×10** |
| Visibility | **Pinned:** always visible (filled). **Unpinned:** hover only — leaf gutter row, canvas band (`hoveredLaneId`), or pin `:focus-visible` |
| Unpinned (lane hover) | **Outline** pushpin; stroke `#a8a8a8` (chevron family) |
| Pinned / pin hover | **Solid fill** accent blue `#4a90e2` (match toolbar measure-active) |
| Tooltip | Localized **置顶** / **Pin to top** (`t('pin')`) on hover/focus over pushpin; dark rounded bubble (EventTooltip chrome: `#2a2a2a` / `#555`) |
| Row hover | Full gutter row highlight `#252525` when pointer over the leaf row (gutter or via canvas `hoveredLaneId`) |
| Accessibility | Focusable `button`; `aria-label` **置顶**; pinned state reflected in `aria-pressed` |

**Indent:** leaf and folder pad-left stay **`24px + depth×14px`** (pin does not add a column). Pin sits in the left margin to the left of chevrons/names at every depth.

## Visual

### Util bars (`visual/gutter-util.png`, `visual/util-bars.png`, `visual/util-midline.png`, `visual/util-midline-detail.png`)

| Token | Value |
|-------|--------|
| Track width | `110px` (fixed column) |
| Thick height | `16px` — folders and depth-0 leaves (`通信`, `储存HBM`, `计算`, `CoreN.*`) |
| Thin height | `8px` — pipe leaves under Core (`ALL`, `SCALAR`, `MTE*`, …) |
| Shape | Rounded rect: `border-radius: 2px` (not a full capsule / `height/2`) |
| Track / unfilled | Gray **diagonal hatch** — repeating `-45deg` stripes `#3a3a3a` on `#2a2a2a` |
| Value fill | **Two colors only:** util &lt; 0.5 → `#733234` (red); util ≥ 0.5 → `#5c5c5c` (gray). Do **not** use pipe/category `lane.color` |
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
| Layout box | `10×10` (match chevron scale) |
| Position | Flush **left** of gutter row (absolute); same x at every nest depth |
| Visibility | Unpinned: only while leaf row / canvas band hovered (or pin focused). **Pinned: always visible** (original + sticky strip) |
| Unpinned | Outline stroke `#a8a8a8` |
| Pinned / pin hover | Solid fill `#4a90e2` |
| Tooltip | **置顶** |
| Row hover | `#252525` on full gutter leaf row |

## Acceptance Criteria

1. **PR-GUTTER-001** — Renders lane names for each group (including nested when expanded).
2. **PR-GUTTER-002** — Shows utilization percent **inside** the util bar (right-aligned) on leaves and folders when set.
3. **PR-GUTTER-003** — Nested folders show open-angle carets; leaf lanes have **no** chevron; folder click emits `toggle-group` with node id. Card expand UI lives on SwimlaneView strips (gutter Card is a spacer).
4. **PR-GUTTER-004** — When a Card id is in `collapsedIds`, child lanes are hidden. When a nested folder id is collapsed, its descendants are hidden but the folder row remains.
5. **PR-GUTTER-005** — Nested indent increases with depth; only Card uses group-header spacer chrome.
6. **PR-GUTTER-006** — Util fills are red (`#733234`) when util &lt; 0.5 and gray (`#5c5c5c`) when ≥ 0.5; never pipe-category colors. Thick class on folders/depth-0; thin on deeper leaves. Thin bars omit the % label.
7. **PR-GUTTER-007** — Filled util tracks show a vertical `1px dashed rgba(255,255,255,0.1)` midline at 50% width; empty util slots do not.
8. **PR-GUTTER-008** — Card row is a non-interactive 28px spacer (`data-testid` `gutter-group-*`); no Card toggle button in the gutter.
9. **PR-GUTTER-010** — Leaf rows include a pushpin control (DOM); folder/Card rows omit pin. Unpinned pin hidden until leaf/canvas hover (or focus); **pinned pin always visible**.
10. **PR-GUTTER-011** — Unpinned outline `#a8a8a8` on lane hover; pinned/pin-hover solid `#4a90e2`. Pin stays flush-left (not depth-indented).
11. **PR-GUTTER-012** — Pushpin hover/focus shows localized pin tooltip (`置顶` / `Pin to top`).
12. **PR-GUTTER-013** — Click unpinned pin emits `pin-lane`; pinned emits `unpin-lane`.

## Edge Cases

| State | Behavior |
|---|---|
| Empty groups array | Empty gutter |
| Groups with zero lanes | Card spacer rendered, no lane rows |
| Standalone CTEF (no pipe data) | All lanes show empty util slot (no %) |
| Flat CTEF (no `children`) | Card → leaf lanes only (MVP-compatible) |
| Very long thread names | CSS text-overflow truncation |
| Scroll position mismatch | Bidirectional sync corrects |
| Pin leaf inside collapsed folder | Pin control hidden while ancestor folder collapsed; id may remain in **pinnedLaneIds** |
| Pin across Cards | Pushpin on any visible leaf regardless of Card/process ancestry |
| Duplicate pin click | Idempotent — no duplicate entries in `pinnedLaneIds` |
| Canvas leaf hover | `hoveredLaneId` from body canvas shows pin + `#252525` on matching gutter row |

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
- **2026-08-28** — Pin glyph: PyPTO/DevUI `pushpin` / `pushpin-fill` SVG assets under `src/ui/icons/`.
- **2026-08-28** — Pinned pushpin stays visible on original + sticky strip; unpinned remains hover-only.
- **2026-08-28** — Pin hover-only, flush-left (no depth indent); row `#252525` on lane/canvas hover; leaf indent unchanged (`24 + depth×14`).
- **2026-08-27** — Renumber pin ACs to `PR-GUTTER-010`…`013` (reserve `009` for #45 gutter-metrics).
- **2026-08-27** — Pin pushpin on leaf rows; crops + visual tokens from `v930/hardware-more-detail` (`PR-GUTTER-010`…`013`). Tests deferred until implementation.
- **2026-08-21** — Util bars: 50% dashed midline (`PR-GUTTER-007`); tight midline crops. Card spacer renumbered to `PR-GUTTER-008`.
- **2026-08-13** — Card chrome moved to SwimlaneView full-width strips; gutter Card is spacer.
- **2026-08-11** — Util bars: thick/thin by depth; red/gray threshold fills only.
- **2026-08-11** — Nested Card → category → Core → pipe; Card-only group header; folder lane-rows with util.
- **2026-08-07** — Util bars inside track; open-angle carets.
