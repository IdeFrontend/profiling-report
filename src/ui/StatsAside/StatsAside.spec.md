# StatsAside

<!--
  spec-id-prefix: PR-STATS-*
  phase: MVP
  source: src/ui/StatsAside/StatsAside.vue
  test: src/ui/StatsAside/StatsAside.spec.ts
-->

Right analytics panel: report summary + PIPE occupancy bars.

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| report | ReportViewModel or null or undefined | yes | — | Report view model |
| locale | string | no | undefined | Locale code |

**Behavior:** Renders op name, type, duration from ReportViewModel. Renders PIPE occupancy bars per [COLOR_TOKENS](/docs/specs/ui/COLOR_TOKENS.md). Null report → empty state. Empty pipe occupancy → no bars.

- [Report stats](/docs/specs/ui/source/report-stats.png) — summary cards
- [PIPE occupancy](/docs/specs/ui/source/pipe-occupancy.png) — utilization bars per pipe family
- [PIPE details](/docs/specs/ui/source/pipe-details.png) — field list (P2)
- [Roofline](/docs/specs/ui/source/roofline.png) — compute/bandwidth chart (P2)
- [Memory load heatmap](/docs/specs/ui/source/memory-load-heatmap.png) (P2)
- [Memory topology annotated](/docs/specs/ui/source/memory-topology-annotated.png) (P2)

## Acceptance Criteria

1. **PR-STATS-001**: Renders summary stats when valid ReportViewModel is provided.
1. **PR-STATS-002**: Renders PIPE occupancy bars with correct colors.

**Dependencies:** [COLOR_TOKENS.md](/docs/specs/ui/COLOR_TOKENS.md), [view-models](/specs/core/view-models.spec.md).

**Open:** Q6 — Product-final summary (currently thin per I-Q6a).
