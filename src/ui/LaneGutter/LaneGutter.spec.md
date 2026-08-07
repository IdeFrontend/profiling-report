# LaneGutter

| spec-id-prefix |
|----------------|
| PR-GUTTER-*    |

Left-side vertical gutter showing process/thread hierarchy, lane names, and utilization percentages. Scroll-synced with the swimlane canvas so lane labels align with event rows.

Normative chrome tokens: [`docs/specs/ui/components/VISUAL_SPEC.md`](../../../docs/specs/ui/components/VISUAL_SPEC.md) (§1 util bars, §4 expanders). Crops: [`lane-expanders.png`](../../../docs/specs/ui/components/lane-expanders.png), [`lane-expander-detail.png`](../../../docs/specs/ui/components/lane-expander-detail.png), [`lane-gutter-util.png`](../../../docs/specs/ui/components/lane-gutter-util.png), [`lane-util-bars.png`](../../../docs/specs/ui/components/lane-util-bars.png).

## Inputs

**groups** is an array of `{ id, name, lanes }` where each lane has `{ id, name, color, utilization? }`. The parent ProfilingReport builds this from the SwimlaneModel, assigning colors via `colorVarForLaneName` and reading utilization from `thread.utilization` (populated by pipe color matching in `adaptRep`). Threads from standalone CTEF or without matching pipes show no utilization percentage.

**collapsedIds** (optional `string[]`) — group ids whose child lanes are hidden. Parent owns collapse state so the swimlane canvas can mirror the visible row set (`displaySwim`).

## Outputs

**scroll** fires when the user scrolls the gutter. The parent reads the gutter's `scrollTop` and propagates it as `scrollY` to the swimlane canvas. The element is exposed via `defineExpose` for imperative scroll sync in the reverse direction.

**toggle-group** fires with a group `id` when the user clicks a group header. Parent toggles that id in `collapsedIds`.

## Behavior

### Hierarchy + expanders

Each group corresponds to a process; lanes correspond to threads.

| Element | Visual (normative) |
|---------|-------------------|
| Group chevron | **Open-angle** stroke caret — **not** filled unicode `▾`/`▸`. Expanded = **down**; collapsed = **right**. Color `#a8a8a8`. Layout box `10×10`, stroke ~1.2px. |
| Lane chevron | **Omitted** when the lane has no children (MVP: threads are leaves). Nested lane expand is P2 — only then show a right caret on expandable lanes. |
| Alignment | Lane **label** left edge aligns under the group **title** (pad-left `24px` = group pad `8` + chev `10` + gap `6`). |
| Gap | Group chevron → label `6px`. |
| Group label | `12px` / weight `600` / `#e8e8e8`; row height `28px` (`LANE_GROUP_HEADER_HEIGHT`). |
| Lane label | `11px` / weight `400` / `#b0b0b0`; row height `22px` (`LANE_HEIGHT`); truncated with ellipsis. |
| Separators | `1px` rule under group header and under each lane (`#3a3a3a` / `#333`). |
| Gutter surface | Background `#262626`; right border `1px solid #3a3a3a`. |

Clicking the **group** header toggles expand/collapse (`aria-expanded`). Collapse hides child lanes; parent must sync the canvas model so row heights stay aligned.

### Utilization

Each lane optionally shows a utilization **pill bar** (`110×16px`, `border-radius: 8px`) with the percentage **inside, right-aligned**. Fill width encodes load; util &lt; 0.5 uses warning red `#733234`, otherwise lane `color`. Layout columns: `minmax(0,1fr)` (name) + `110px` (util).

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

- [lane-expanders.png](../../../docs/specs/ui/components/lane-expanders.png)
- [lane-expander-detail.png](../../../docs/specs/ui/components/lane-expander-detail.png)
- [lane-gutter-util.png](../../../docs/specs/ui/components/lane-gutter-util.png)
- [with_sidebar.png](../../../docs/specs/ui/with_sidebar.png)

## Dependencies

[utilization](../../../specs/core/utilization.spec.md).

**Input formats:** [METRICS_AND_TRACE.md](../../../docs/specs/formats/METRICS_AND_TRACE.md) (PipeUtilization.csv feeds lane utilization via pipe color matching).

## Changelog
- **2026-08-07** — Leaf lanes: no expander chevron (only groups / nodes with children).
- **2026-08-07** — Spec: open-angle expanders, lane chevrons, typography/margins, `collapsedIds` / `toggle-group`; util pill tokens; link visual crops.
- **2026-08-05** — Initial spec. Core behaviors established.
