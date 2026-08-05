# LaneGutter

<!--
  spec-id-prefix: PR-GUTTER-*
  phase: MVP
  source: src/ui/LaneGutter/LaneGutter.vue
  test: src/ui/LaneGutter/LaneGutter.spec.ts
-->

Left-side vertical gutter showing process/thread hierarchy, lane names, and utilization percentages. Scroll-synced with the swimlane canvas.

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| groups | GutterGroup[] | yes | — | Groups of lanes with metadata |

`GutterGroup = { id, name, lanes: { id, name, color, utilization? }[] }`.

## Emits

| Event | Payload | Description |
|-------|---------|-------------|
| scroll | — | Gutter scrolled — parent syncs swimlane canvas scrollY |

## Behavior

**Hierarchy display.** Each group corresponds to a process. Within each group, lanes correspond to threads. Process names are shown as section headers with a colored strip. Thread names and utilization percentages appear below. The gutter uses the same lane height (22px) as the swimlane canvas so rows align.

**Scroll sync.** The gutter scrollbar drives swimlane scroll position. When the user scrolls the gutter, `emit('scroll')` fires. The parent ProfilingReport reads the gutter's `scrollTop` (exposed via `defineExpose`) and propagates it as `scrollY` to the swimlane canvas and renderer. Conversely, when the swimlane canvas synthesizes scroll, the gutter's `scrollTop` is set imperatively.

**Utilization.** Each lane optionally shows a utilization percentage computed by `withDerivedUtilizations`. Only threads with matching pipe lanes in the `.rep` data get utilization values. Threads from standalone CTEF or without matching pipes show no percentage.

**Colors.** Lane color strips match the `colorKey` from `laneColors` — the same colors used for PIPE bars and swimlane event fills. Colors are consistent across all surfaces per COLOR_TOKENS.

## Acceptance Criteria

1. **PR-GUTTER-001**: Renders lane names for each group with process headers.
1. **PR-GUTTER-002**: Shows utilization percentage when provided.

## Edge Cases

- Empty groups array → empty gutter, no content.
- Very long thread names → CSS text-overflow truncation.
- Groups with zero lanes → group header rendered, no lane rows.

## Design sketches

- [Entry overview](/docs/specs/ui/source/entry-overview.png)

**Dependencies:** [utilization](/specs/core/utilization.spec.md).
