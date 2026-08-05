# StatsAside

<!--
  spec-id-prefix: PR-STATS-*
  phase: MVP
  source: src/ui/StatsAside/StatsAside.vue
  test: src/ui/StatsAside/StatsAside.spec.ts
-->

Right-side analytics panel showing report summary statistics and PIPE occupancy bars.

## Inputs

**report** carries the full `ReportViewModel` with `summary` (op name, type, duration, block dim, frequencies) and `pipeOccupancy` (per-family utilization ratios). Optional **locale** localizes labels. The parent hides the entire panel via `ReportLayout` when no data is available (standalone CTEF).

## Outputs

Purely presentational — no emitted events.

## Behavior

**Summary section.** Displays operator metadata from `report.summary`: op name, op type, task duration (formatted in the current time unit), block dimension, and current/rated frequencies. These come from `OpBasicInfo.csv`. In MVP, only thin fields are populated per I-Q6a — compute TFLOPS, bandwidth, and core utilization fields exist in the type but are intentionally unset.

**PIPE occupancy bars.** Renders a horizontal bar chart showing utilization for each pipe family: Cube, Vector, MTE1, MTE2, MTE3, FixP, and Scalar. Values are per-family means of non-NA ratios across all blocks, computed in `adaptRep` per I-Q6b. Bar colors match COLOR_TOKENS — the same colors used in the lane gutter and swimlane event fills. Colors are consistent across all surfaces so a user can visually correlate a pipe bar to the corresponding lane.

**Panel modes (P2).** The aside panel can switch between multiple views: summary+pipe occupancy (MVP), pipe field details, roofline chart, memory topology, and memory heatmap. All P2 modes are gated behind `ReportCapability` flags.

## Acceptance Criteria

1. **PR-STATS-001** — Renders summary stats.
2. **PR-STATS-002** — Renders PIPE bars with correct colors.

## Edge Cases

| State | Behavior |
|---|---|
| report is null or undefined | Empty panel, no error |
| Empty pipeOccupancy | No bars; summary still visible if present |
| All NA ratios for a family | Bar shows 0 length |
| Empty summary (standalone CTEF) | Panel hidden by parent (ReportLayout showAside=false) |
| Missing compute/BW fields (I-Q6a) | Fields are absent, no placeholder shown |

## Design sketches

- [Report stats](../../../docs/specs/ui/source/report-stats.png) — summary cards
- [PIPE occupancy](../../../docs/specs/ui/source/pipe-occupancy.png) — utilization bars
- [PIPE details](../../../docs/specs/ui/source/pipe-details.png) — field list (P2)
- [Roofline](../../../docs/specs/ui/source/roofline.png) — chart (P2)
- [Memory load heatmap](../../../docs/specs/ui/source/memory-load-heatmap.png) (P2)
- [Memory topology](../../../docs/specs/ui/source/memory-topology-annotated.png) (P2)

## Dependencies

[COLOR_TOKENS.md](../../../docs/specs/ui/COLOR_TOKENS.md), [view-models](../../../specs/core/view-models.spec.md).

**Input formats:** [METRICS_AND_TRACE.md](../../../docs/specs/formats/METRICS_AND_TRACE.md) (OpBasicInfo.csv and PipeUtilization.csv schemas), [INPUT_FORMATS.md](../../../docs/specs/formats/INPUT_FORMATS.md) (container contract).

## Open

Q6 — Product-final summary formulas (currently thin per I-Q6a).
