# OverviewCharts

| spec-id-prefix |
|----------------|
| PR-OV-*        |

Renders `ReportViewModel.overviewSeries` as the **统计分析** block **inside** the swim scroll body (below the time axis / pinned strips). Source: product `Sampling.json` `ph:C` ([DATA-39](../../../../docs/context/decisions/DATA.md)) — one track per counter name present. Hidden when `overviewSeries` is empty ([DATA-32](../../../../docs/context/decisions/DATA.md)).

## Layout (v930/entry + PyPTO pin)

```text
┌ time axis ─────────────────────────────────────────────┐
├ pinned lanes (sticky) ─────────────────────────────────┤
├ pinned overview tracks (sticky) ───────────────────────┤
│ ▾ 统计分析 + tracks (scroll with lanes)                │
│ Card / cores / pipes …                                 │
└────────────────────────────────────────────────────────┘
```

- **Placement:** scrollable section at the top of the swim **body** (moves with `scrollY`). Sticky duplicates of pinned series sit **below** the pinned-lane strip and **above** the scrolling body.
- **Gutter column:** width = TimelineView gutter (`gutterWidth` prop); labels left-aligned; section header with chevron + localized **统计分析** / Statistical analysis.
- **Track height:** **16px** paint area per series.
- **Gap:** **8px** margin between consecutive tracks.
- **Style:** **step-after** area + stroke (hold each sample value until the next counter event, then jump). Fill `fill-opacity ≈ 0.45` under a bright stroke. Colors from [COLOR_TOKENS](../../../../docs/ui/COLOR_TOKENS.md) by counter name (`cube` → `--pr-color-overview-cube`, etc.).
- **Time domain:** shared with swimlane visible `[startTime, endTime]` (canonical ns).
- **Cursor:** shared playhead vertical line (`#317af7`) over the chart column; hover on a track shows an EventTooltip-styled tip with the step value at the cursor time.
- **Pin (PyPTO parity):** each track gutter has a **置顶** pushpin (hover-reveal unpinned; always visible when pinned / in sticky strip). Click toggles `pinnedOverviewIds`.

## Acceptance Criteria

1. **PR-OV-001** — Renders one labeled track per `OverviewSeries` entry; section header present.
2. **PR-OV-002** — Each track SVG is 16px tall; consecutive tracks are separated by 8px margin.
3. **PR-OV-003** — Mounted in the swim body below the time axis (DOM: axis → swimlane containing overview).
4. **PR-OV-004** — Series paths are step-after: value stays constant until the next sample time, then jumps (no diagonal interpolation between samples).
5. **PR-OV-005** — Track pushpin emits `pin-overview` / `unpin-overview`; sticky strip (`variant=strip`) shows pinned series in pin order **below** the lane pin strip.
6. **PR-OV-006** — Shared cursor x draws a vertical line over chart tracks; hovering a track shows the step value at cursor time in an EventTooltip-styled tip.
## Visual

- [`visual/overview-charts.png`](./visual/overview-charts.png) — full 统计分析 block
- [`visual/overview-charts-gutter.png`](./visual/overview-charts-gutter.png) — gutter labels
- [`visual/overview-charts-track.png`](./visual/overview-charts-track.png) — Cube stroke+fill detail

## Dependencies

[view-models](../../../../specs/core/view-models.spec.md) PR-VM-003, [UI_OVERVIEW](../../../../docs/ui/UI_OVERVIEW.md), [COMPONENTS](../../../../docs/architecture/COMPONENTS.md).
