# LaneGutter

| spec-id-prefix |
|----------------|
| PR-GUTTER-*    |

Left-side vertical gutter showing process/thread hierarchy, lane names, and utilization percentages. Scroll-synced with the swimlane canvas so lane labels align with event rows.

Crops: [`visual/expanders.png`](./visual/expanders.png), [`visual/expander-detail.png`](./visual/expander-detail.png), [`visual/gutter-util.png`](./visual/gutter-util.png), [`visual/util-bars.png`](./visual/util-bars.png) — provenance in [`visual/provenance.yaml`](./visual/provenance.yaml).

## Inputs

**groups** is an array of `{ id, name, lanes }` where each lane has `{ id, name, color, utilization? }`. The parent ProfilingReport builds this from the SwimlaneModel, assigning colors via `colorVarForLaneName` and reading utilization from `thread.utilization` (populated by pipe color matching in `adaptRep`). Threads from standalone CTEF or without matching pipes show no utilization percentage.

**collapsedIds** (optional `string[]`) — group ids whose child lanes are hidden. Parent owns collapse state so the swimlane canvas can mirror the visible row set (`displaySwim`).

## Outputs

**scroll** fires when the user scrolls the gutter. The parent reads the gutter's `scrollTop` and propagates it as `scrollY` to the swimlane canvas. The element is exposed via `defineExpose` for imperative scroll sync in the reverse direction.

**toggle-group** fires with a group `id` when the user clicks a group header. Parent toggles that id in `collapsedIds`.

## Behavior

### Hierarchy + expanders

Each group corresponds to a process; lanes correspond to threads. Group headers and event-sequence lanes draw a `#3a3a3a` bottom border so horizontal dividers continue into the swimlane surface.
| Element | Visual (normative) |
|---------|-------------------|
| Group chevron | **Open-angle** stroke caret — **not** filled unicode `▾`/`▸`. Expanded = **down**; collapsed = **right**. Color `#a8a8a8`. Layout box `10×10`, stroke ~1.2px. |
| Lane chevron | **Omitted** when the lane has no children (MVP: threads are leaves). Nested lane expand is P2 — only then show a right caret on expandable lanes. |
| Alignment | Lane **label** left edge aligns under the group **title** (pad-left `24px` = group pad `8` + chev `10` + gap `6`). |
| Gap | Group chevron → label `6px`. |
| Group label | `12px` / weight `600` / `#e8e8e8`; row height `28px` (`LANE_GROUP_HEADER_HEIGHT`). |
| Lane label | `11px` / weight `400` / `#b0b0b0`; row height `22px` (`LANE_HEIGHT`); truncated with ellipsis. |
| Separators | `1px` rule under group header and under each lane (`#3a3a3a` / `#333`). |
| Gutter surface | Lane rows `#1f1f1f` (`--pr-bg-deep`); group headers `#262626` (`--pr-bg-panel`); right border `1px solid #3a3a3a`. |

Clicking the **group** header toggles expand/collapse (`aria-expanded`). Collapse hides child lanes; parent must sync the canvas model so row heights stay aligned.

### Utilization

Each lane optionally shows a utilization bar with the percentage **inside, right-aligned**. See **Visual** below.

## Visual

### Util bars (`visual/gutter-util.png`, `visual/util-bars.png`)

| Token | Value |
|-------|--------|
| Track width | `110px` (fixed column) |
| Track height | `16px` |
| Shape | Rounded rect: `border-radius: 2px` (not a full capsule / `height/2`) |
| Track / unfilled | Gray **diagonal hatch** (not solid black) — e.g. repeating `-45deg` stripes `#3a3a3a` on `#2a2a2a` |
| Value fill | Lane `color` (pipe category), left-aligned width = util% |
| Warning fill | `#733234` when util &lt; 0.5 (optional; sketches use red for hot/low cores) |
| % text | **Inside** track, **right-aligned**, `padding-right: 6px` |
| % font | 10px, weight 600, tabular-nums, color **`#b0b0b0`** (same as lane title — not bright white) |
| Layout | `grid-template-columns: minmax(0,1fr) 110px` (name + util); pad-left aligns label under group title |

**Do not** place `%` to the left of the bar.

### Expanders (`visual/expanders.png`, `visual/expander-detail.png`)

| Token | Value |
|-------|--------|
| Icon style | **Open-angle** stroke chevron (CSS borders), not filled `▾`/`▸` |
| Group expanded | Down-pointing caret (`v`), color `#a8a8a8` |
| Lane chevron | **Only if** the lane has expandable children (P2). MVP leaf threads: **no** chevron |
| Alignment | Lane **label** left edge aligns under the group **title** (pad-left `24px` = group pad `8` + chev `10` + gap `6`) |
| Gap chevron→label | `6px` (group row) |
| Group row | height `28px`; pad-left `8px`; label **12px / 600 / `#e8e8e8`** |
| Lane row | height `22px`; pad-left `24px`; label **11px / 400 / `#b0b0b0`** |
| Separators | `1px solid #333` under each lane; `#3a3a3a` under group header |
| Gutter bg | Lane rows `#1f1f1f`; group headers `#262626`; right border `#3a3a3a` |
| Interaction | Group header click → `toggle-group`; no chevron control on leaf lanes |

## Acceptance Criteria

1. **PR-GUTTER-001** — Renders lane names for each group.
2. **PR-GUTTER-002** — Shows utilization percent **inside** the util bar (right-aligned).
3. **PR-GUTTER-003** — Group expander uses open-angle carets; expanded shows down, collapsed shows right; leaf lanes have **no** chevron; click emits `toggle-group` with group id.
4. **PR-GUTTER-004** — When group id is in `collapsedIds`, child lanes are hidden; `aria-expanded="false"`.

## Edge Cases

| State | Behavior |
|---|---|
| Empty groups array | Empty gutter |
| Groups with zero lanes | Group header rendered, no lane rows |
| Standalone CTEF (no pipe data) | All lanes show empty util slot (no %) |
| Very long thread names | CSS text-overflow truncation |
| Scroll position mismatch | Bidirectional sync corrects |
| Nested pipe children under a lane | P2 — show lane chevron only when children exist |
| Leaf lanes (MVP threads) | No expander chevron |

## Design sketches

- [expanders](./visual/expanders.png) — from `v930/entry`
- [expander-detail](./visual/expander-detail.png) — from `v930/entry`
- [gutter-util](./visual/gutter-util.png) — from `v930/entry`
- [util-bars](./visual/util-bars.png) — from `v930/entry`
- [v930 entry](../../../../../docs/ui/source/v930/entry.jpeg) — full layout context

## Dependencies

[utilization](../../../../../specs/core/utilization.spec.md).

**Input formats:** [METRICS_AND_TRACE.md](../../../../../docs/formats/METRICS_AND_TRACE.md) (PipeUtilization.csv feeds lane utilization via pipe color matching).

## Changelog
- **2026-08-11** — Gutter lane bg `#1f1f1f`; group headers `#262626` (sketch-sampled surfaces).
- **2026-08-07** — Row bottom borders align with swimlane horizontal dividers (`#3a3a3a`).
- **2026-08-07** — Util bar: radius 2px, diagonal hatch unfilled, % color `#b0b0b0`.
- **2026-08-07** — Leaf lanes: no expander chevron (only groups / nodes with children).
- **2026-08-07** — Spec: open-angle expanders, lane chevrons, typography/margins, `collapsedIds` / `toggle-group`; util pill tokens; link visual crops.
- **2026-08-05** — Initial spec. Core behaviors established.
