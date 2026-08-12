# LaneGutter

| spec-id-prefix |
|----------------|
| PR-GUTTER-*    |

Left-side vertical gutter showing Card / nested lane hierarchy, lane names, and utilization percentages. Scroll-synced with the swimlane canvas so lane labels align with event rows.

Crops: [`visual/expanders.png`](./visual/expanders.png), [`visual/expander-detail.png`](./visual/expander-detail.png), [`visual/gutter-util.png`](./visual/gutter-util.png), [`visual/util-bars.png`](./visual/util-bars.png) — provenance in [`visual/provenance.yaml`](./visual/provenance.yaml).

## Inputs

**groups** is an array of Card groups `{ id, name, lanes }` where each lane is a recursive node `{ id, name, color, utilization?, children? }`.

- **Card** (`SwimProcess`) → group header only.
- **Nested folder** (`children` non-empty) → lane-style row with chevron + util; no canvas events.
- **Leaf** (no children) → lane row; util optional.

Parent builds this from `SwimlaneModel`, assigning colors via `colorVarForLaneName` and reading `utilization` from each node. Flat CTEF (no `children`) still works as Card → leaf lanes.

**collapsedIds** (optional `string[]`) — ids of Cards or nested folders whose **descendants** are hidden (the collapsed node row itself stays visible for nested folders; collapsing a Card hides all its lanes). Parent owns collapse so the canvas mirrors the visible row set (`displaySwim`).

## Outputs

**scroll** fires when the user scrolls the gutter. The parent reads the gutter's `scrollTop` and propagates it as `scrollY` to the swimlane canvas. The element is exposed via `defineExpose` for imperative scroll sync in the reverse direction.

**toggle-group** fires with a node `id` (Card or nested folder) when the user clicks a header/folder row. Parent toggles that id in `collapsedIds`.

## Behavior

### Hierarchy + expanders

| Element | Visual (normative) |
|---------|-------------------|
| Card chevron | **Open-angle** stroke caret. Expanded = **down**; collapsed = **right**. Color `#a8a8a8`. Layout box `10×10`, stroke ~1.2px. |
| Nested folder chevron | Same caret on lane-style rows that have `children`. |
| Leaf chevron | **Omitted**. |
| Card label | `12px` / weight `600` / `#e8e8e8`; row height `28px` (`LANE_GROUP_HEADER_HEIGHT`). |
| Lane / folder label | `11px` / weight `400` / `#b0b0b0`; row height `22px` (`LANE_HEIGHT`); truncated with ellipsis. |
| Indent | Depth 0 under Card: pad-left `24px` (= group pad `8` + chev `10` + gap `6`). Each nested level adds `14px`. |
| Separators | `1px` rule under Card header and under each lane/folder (`#3a3a3a` / `#333`). |
| Gutter surface | Lane rows `#1f1f1f` (`--pr-bg-deep`); Card headers `#262626` (`--pr-bg-panel`); right border `1px solid #3a3a3a`. |

Clicking the **Card** header or a **folder** lane toggles expand/collapse (`aria-expanded`). Collapse hides descendants; parent syncs canvas row heights.

### Utilization

Each lane **and folder** row optionally shows a utilization bar with the percentage **inside, right-aligned**. See **Visual** below.

## Visual

### Util bars (`visual/gutter-util.png`, `visual/util-bars.png`)

| Token | Value |
|-------|--------|
| Track width | `110px` (fixed column) |
| Thick height | `16px` — folders and depth-0 leaves (`通信`, `储存HBM`, `计算`, `CoreN.*`) |
| Thin height | `8px` — pipe leaves under Core (`ALL`, `SCALAR`, `MTE*`, …) |
| Shape | Rounded rect: `border-radius: 2px` (not a full capsule / `height/2`) |
| Track / unfilled | Gray **diagonal hatch** — repeating `-45deg` stripes `#3a3a3a` on `#2a2a2a` |
| Value fill | **Two colors only:** util &lt; 0.5 → `#733234` (red); util ≥ 0.5 → `#5c5c5c` (gray). Do **not** use pipe/category `lane.color` |
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
| Interaction | Card header or folder row click → `toggle-group` |

## Acceptance Criteria

1. **PR-GUTTER-001** — Renders lane names for each group (including nested when expanded).
2. **PR-GUTTER-002** — Shows utilization percent **inside** the util bar (right-aligned) on leaves and folders when set.
3. **PR-GUTTER-003** — Card expander uses open-angle carets; nested folders show chevrons; leaf lanes have **no** chevron; click emits `toggle-group` with node id.
4. **PR-GUTTER-004** — When a Card id is in `collapsedIds`, child lanes are hidden; `aria-expanded="false"`. When a nested folder id is collapsed, its descendants are hidden but the folder row remains.
5. **PR-GUTTER-005** — Nested indent increases with depth; only Card uses group-header chrome.
6. **PR-GUTTER-006** — Util fills are red (`#733234`) when util &lt; 0.5 and gray (`#5c5c5c`) when ≥ 0.5; never pipe-category colors. Thick class on folders/depth-0; thin on deeper leaves. Thin bars omit the % label.

## Edge Cases

| State | Behavior |
|---|---|
| Empty groups array | Empty gutter |
| Groups with zero lanes | Card header rendered, no lane rows |
| Standalone CTEF (no pipe data) | All lanes show empty util slot (no %) |
| Flat CTEF (no `children`) | Card → leaf lanes only (MVP-compatible) |
| Very long thread names | CSS text-overflow truncation |
| Scroll position mismatch | Bidirectional sync corrects |

## Design sketches

- [expanders](./visual/expanders.png) — from `v930/entry`
- [expander-detail](./visual/expander-detail.png) — from `v930/entry`
- [gutter-util](./visual/gutter-util.png) — from `v930/entry`
- [util-bars](./visual/util-bars.png) — from `v930/entry`

## Changelog
- **2026-08-11** — Util bars: thick/thin by depth; red/gray threshold fills only.
- **2026-08-11** — Nested Card → category → Core → pipe; Card-only group header; folder lane-rows with util.
- **2026-08-07** — Util bars inside track; open-angle carets.
