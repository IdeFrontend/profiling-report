# LaneGutter

<!--
  spec-id-prefix: PR-GUTTER-*
  phase: MVP
  source: src/ui/LaneGutter/LaneGutter.vue
  test: src/ui/LaneGutter/LaneGutter.spec.ts
-->

Left-side vertical gutter showing process/thread hierarchy, lane names, and utilization percentages. Scroll-synced with the swimlane canvas so lane labels align with event rows.

## Inputs

**groups** is an array of `{ id, name, lanes }` where each lane has `{ id, name, color, utilization? }`. The parent ProfilingReport builds this from the SwimlaneModel, assigning colors via `colorForThread` and attaching utilization via `withDerivedUtilizations`.

## Outputs

**scroll** fires when the user scrolls the gutter. The parent reads the gutter's `scrollTop` and propagates it as `scrollY` to the swimlane canvas. The element is exposed via `defineExpose` for imperative scroll sync in the reverse direction.

## Behavior

**Hierarchy display.** Each group corresponds to a process. Within each group, lanes correspond to threads. Process names appear as section headers with a colored strip. Thread names and utilization percentages appear below. The gutter uses the same lane height (22px) as the swimlane canvas — rows stay aligned during scroll.

**Scroll sync.** When the user scrolls the gutter, it emits `scroll`. The parent ProfilingReport reads the gutter's `scrollTop` and propagates it as `scrollY` to the swimlane canvas. Conversely, when the canvas synthesizes scroll, the gutter's scroll position is set imperatively. This bidirectional sync ensures labels always align with their lanes regardless of which element the user scrolls.

**Utilization.** Each lane optionally shows a utilization percentage computed by `withDerivedUtilizations`. Only threads with matching pipe lanes in the `.rep` data get values — threads from standalone CTEF or without matching pipes show no percentage.

**Colors.** Lane color strips match the `colorKey` from `laneColors` — the same colors used for PIPE bars and swimlane event fills. Consistent color assignment across surfaces allows visual correlation.

## Acceptance Criteria

1. **PR-GUTTER-001** — Renders lane names.
2. **PR-GUTTER-002** — Shows utilization.

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
