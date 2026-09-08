# OverviewCharts

| spec-id-prefix |
|----------------|
| PR-OV-*        |

Renders `ReportViewModel.overviewSeries` as the **统计分析** block **above** the swimlane (below the time axis). Source: product `Sampling.json` `ph:C` ([DATA-39](../../../../docs/context/decisions/DATA.md)) — one track per counter name present. Hidden when `overviewSeries` is empty ([DATA-32](../../../../docs/context/decisions/DATA.md)).

## Layout (v930/entry)

```text
┌ gutter (same width as LaneGutter) ┬ chart track (time-aligned) ┐
│ ▾ 统计分析                         │                           │
│   SCALAR                           │ ████ area 16px            │
│   MTE1                             │ ████   + 8px gap          │
│   CUBE                             │ ████                      │
└────────────────────────────────────┴───────────────────────────┘
          ↓ SwimlaneView (Card / cores / pipes)
```

- **Placement:** immediately under the viewport time axis; **above** `SwimlaneView`.
- **Gutter column:** width = TimelineView gutter (`gutterWidth` prop); labels left-aligned; section header with chevron + localized **统计分析** / Statistical analysis.
- **Track height:** **16px** paint area per series.
- **Gap:** **8px** margin between consecutive tracks.
- **Style:** **step-after** area + stroke (hold each sample value until the next counter event, then jump). Fill `fill-opacity ≈ 0.45` under a bright stroke. Colors from [COLOR_TOKENS](../../../../docs/ui/COLOR_TOKENS.md) by counter name (`cube` → `--pr-color-overview-cube`, etc.).
- **Time domain:** shared with swimlane visible `[startTime, endTime]` (canonical ns).

## Acceptance Criteria

1. **PR-OV-001** — Renders one labeled track per `OverviewSeries` entry; section header present.
2. **PR-OV-002** — Each track SVG is 16px tall; consecutive tracks are separated by 8px margin.
3. **PR-OV-003** — Mounted above the swimlane in TimelineView (DOM order: time axis → overview → swimlane).
4. **PR-OV-004** — Series paths are step-after: value stays constant until the next sample time, then jumps (no diagonal interpolation between samples).

## Visual

- [`visual/overview-charts.png`](./visual/overview-charts.png) — full 统计分析 block
- [`visual/overview-charts-gutter.png`](./visual/overview-charts-gutter.png) — gutter labels
- [`visual/overview-charts-track.png`](./visual/overview-charts-track.png) — Cube stroke+fill detail

## Dependencies

[view-models](../../../../specs/core/view-models.spec.md) PR-VM-003, [UI_OVERVIEW](../../../../docs/ui/UI_OVERVIEW.md), [COMPONENTS](../../../../docs/architecture/COMPONENTS.md).
