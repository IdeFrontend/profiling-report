# LaneGutter

| spec-id-prefix |
|----------------|
| PR-GUTTER-*    |

Left-side vertical gutter showing process/thread hierarchy, lane names, and utilization percentages. Scroll-synced with the swimlane canvas so lane labels align with event rows.

## Inputs

**groups** is an array of `{ id, name, lanes }` where each lane has `{ id, name, color, utilization? }`. The parent ProfilingReport builds this from the SwimlaneModel, assigning colors via `colorVarForLaneName` and reading utilization from `thread.utilization` (populated by pipe color matching in `adaptRep`). Threads from standalone CTEF or without matching pipes show no utilization percentage.

## Outputs

**scroll** fires when the user scrolls the gutter. The parent reads the gutter's `scrollTop` and propagates it as `scrollY` to the swimlane canvas. The element is exposed via `defineExpose` for imperative scroll sync in the reverse direction.

## Behavior

**Hierarchy display.** Each group corresponds to a process. Within each group, lanes correspond to threads. Process names appear as section headers with a **chevron expander** (INTERACTIONS: click lane header expand/collapse). Collapsed groups hide child lanes; parent syncs the swimlane canvas model. Thread names and utilization appear below when expanded. The gutter uses the same lane height (22px) as the swimlane canvas — rows stay aligned during scroll.

**Utilization.** Each lane optionally shows a utilization **pill bar** (~110×16px) with the percentage **inside, right-aligned** (see `docs/specs/ui/components/VISUAL_SPEC.md`). Fill width encodes load; low util (&lt;50%) uses warning red `#733234`, otherwise lane color.

## Acceptance Criteria

1. **PR-GUTTER-001** — Renders lane names.
2. **PR-GUTTER-002** — Shows utilization percent inside the util bar.
3. **PR-GUTTER-003** — Group expander emits `toggle-group`.
4. **PR-GUTTER-004** — Collapsed group hides child lanes.

## Edge Cases

| State | Behavior |
|---|---|
| Empty groups array | Empty gutter |
| Groups with zero lanes | Group header rendered, no lane rows |
| Standalone CTEF (no pipe data) | All lanes show no utilization % |
| Very long thread names | CSS text-overflow truncation |
| Scroll position mismatch | Bidirectional sync corrects |

## Design sketches

- [Entry overview](../../../docs/specs/ui/source/entry-overview.png)

## Dependencies

[utilization](../../../specs/core/utilization.spec.md).

**Input formats:** [METRICS_AND_TRACE.md](../../../docs/specs/formats/METRICS_AND_TRACE.md) (PipeUtilization.csv feeds lane utilization via pipe color matching).

## Changelog
- **2026-08-07** — Pill util bars 110×16, % right-inside; warning red &lt;50%.
- **2026-08-07** — Group expanders; util % inside larger bar control.
- **2026-08-05** — Initial spec. Core behaviors established.
