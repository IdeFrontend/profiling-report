# StatsAside

<!--
  spec-id-prefix: PR-STATS-*
  phase: MVP
  source: src/ui/StatsAside/StatsAside.vue
  test: src/ui/StatsAside/StatsAside.spec.ts
-->

Right-side analytics panel displaying report summary statistics and PIPE occupancy bars.

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| report | ReportViewModel or null or undefined | yes | — | Report view model with summary and pipeOccupancy |
| locale | string | no | undefined | Locale for UI labels |

## Behavior

**Summary section.** Displays operator metadata from `report.summary`: op name, op type, task duration (formatted in current time unit), block dimension, current/rated frequencies. These come from `OpBasicInfo.csv`. In MVP, only these thin fields are shown per I-Q6a — compute TFLOPS, bandwidth, and core utilization fields exist in the type but are intentionally unset.

**PIPE occupancy bars.** Renders a horizontal bar chart showing utilization for each pipe family (Cube, Vector, MTE1, MTE2, MTE3, FixP, Scalar). Values are per-pipe-family means of non-NA ratios across all blocks, computed in `adaptRep` (I-Q6b). Bar colors match [COLOR_TOKENS](/docs/specs/ui/COLOR_TOKENS.md) — the same colors used in the lane gutter and swimlane.

**Panel modes (P2).** The aside panel can switch between multiple views: summary+pipe occupancy (MVP), pipe field details, roofline chart, memory topology, and memory heatmap. All P2 modes are behind `ReportCapability` flags. The component currently shows the MVP mode.

## Acceptance Criteria

1. **PR-STATS-001**: Renders summary stats (op name, type, duration) when valid ReportViewModel is provided.
1. **PR-STATS-002**: Renders PIPE occupancy bars with colors matching COLOR_TOKENS.

## Edge Cases

- report is null or undefined → renders empty state (panel shown but no data).
- Empty pipeOccupancy → no bars rendered, panel still visible with summary.
- All NA pipe ratios for a family → bar shows 0 length.

## Design sketches

- [Report stats](/docs/specs/ui/source/report-stats.png) — summary cards
- [PIPE occupancy](/docs/specs/ui/source/pipe-occupancy.png) — utilization bars
- [PIPE details](/docs/specs/ui/source/pipe-details.png) — field list (P2)
- [Roofline](/docs/specs/ui/source/roofline.png) — compute/bandwidth chart (P2)
- [Memory load heatmap](/docs/specs/ui/source/memory-load-heatmap.png) (P2)
- [Memory topology annotated](/docs/specs/ui/source/memory-topology-annotated.png) (P2)

**Dependencies:** [COLOR_TOKENS.md](/docs/specs/ui/COLOR_TOKENS.md), [view-models](/specs/core/view-models.spec.md).

**Open:** Q6 — Product-final summary formulas (currently thin per I-Q6a).
