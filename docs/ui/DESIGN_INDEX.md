# Design asset index

Cross-layer map: **sources (v930) → component visual packs**. Pixel measures live in each component `{Name}.spec.md` **Visual** section.

## Layers

| Layer | Path | Role |
|-------|------|------|
| A – sources | [`source/v930/`](./source/v930/) + [`manifest.yaml`](./source/manifest.yaml) | Full-frame dumps (append-only) |
| C – visual packs | nested under `src/ui/{Region}/…/{Component}/visual/` | Crops + `provenance.yaml` next to implementation |

## Source frames (`v930`)

| Id | File | Typical consumers |
|----|------|-------------------|
| `v930/entry` | [`entry.jpeg`](./source/v930/entry.jpeg) | Toolbar, overview, gutter, swimlane, cursor, axis ruler |
| `v930/report-stats-open` | [`report-stats-open.jpeg`](./source/v930/report-stats-open.jpeg) | Stats aside |
| `v930/report-stats-scrolled` | [`report-stats-scrolled.jpeg`](./source/v930/report-stats-scrolled.jpeg) | Aside scroll |
| `v930/search-highlight` | [`search-highlight.jpeg`](./source/v930/search-highlight.jpeg) | Search highlight, cursor timestamp |
| `v930/detail-strip-raised` | [`detail-strip-raised.jpeg`](./source/v930/detail-strip-raised.jpeg) | Detail panel (summary / parameter / relevant) |
| `v930/compute-load` | [`compute-load.jpeg`](./source/v930/compute-load.jpeg) | PIPE occupancy bars |
| `v930/compute-load-detail` | [`compute-load-detail.jpeg`](./source/v930/compute-load-detail.jpeg) | Compute detail, CSV fields |
| `v930/memory-load-detail` | [`memory-load-detail.jpeg`](./source/v930/memory-load-detail.jpeg) | Memory detail, block switcher |
| `v930/hardware-more-detail` | [`hardware-more-detail.jpeg`](./source/v930/hardware-more-detail.jpeg) | Hardware details |
| `v930/task-hover` | [`task-hover.jpeg`](./source/v930/task-hover.jpeg) | Event hover tooltip |
| `v930/task-context-menu` | [`task-context-menu.jpeg`](./source/v930/task-context-menu.jpeg) | Task context menu (P2) |
| `v930/task-marquee` | [`task-marquee.jpeg`](./source/v930/task-marquee.jpeg) | Marquee / multi-select |
| `v930/task-measure-mode` | [`task-measure-mode.jpeg`](./source/v930/task-measure-mode.jpeg) | Time measure mode |
| `v930/task-multi-height` | [`task-multi-height.jpeg`](./source/v930/task-multi-height.jpeg) | Multi-task taller lanes |

## Component visual packs

| Component | Visual pack | Primary source |
|-----------|-------------|----------------|
| [`LaneGutter`](../../src/ui/TimelineView/SwimlaneView/LaneGutter/visual/) | expanders, util bars | `v930/entry` |
| [`TimeOverviewBar`](../../src/ui/TimelineView/TimeOverviewBar/visual/) | range handles | `v930/entry` |
| [`ReportToolbar`](../../src/ui/ReportToolbar/visual/) | search, zoom, actions | `v930/entry` |
| [`CursorTimestamp`](../../src/ui/TimelineView/TimeAxis/CursorTimestamp/visual/) | cursor timestamp | `v930/search-highlight` |
| [`AxisRuler`](../../src/ui/TimelineView/TimeAxis/AxisRuler/visual/) | viewport ticks | `v930/entry` |
| [`StatsAside`](../../src/ui/StatsAside/visual/) | mode tabs, summary, PIPE, scroll, hardware | `v930/report-stats-*`, `v930/compute-*`, `v930/hardware-*` |
| [`DetailPanel`](../../src/ui/DetailPanel/visual/) | full dock chrome | `v930/detail-strip-raised` |
| [`DetailSummary`](../../src/ui/DetailPanel/DetailSummary/visual/) | identity card | `v930/detail-strip-raised` |
| [`DetailParameter`](../../src/ui/DetailPanel/DetailParameter/visual/) | Parameter / Code list | `v930/detail-strip-raised` |
| [`DetailRelevant`](../../src/ui/DetailPanel/DetailRelevant/visual/) | Relevant graph | `v930/detail-strip-raised` |
| [`CsvFieldListPanel`](../../src/ui/StatsAside/CsvFieldListPanel/visual/) | tabs, fields, block switcher | `v930/compute-load-detail`, `v930/memory-load-detail` |
| [`SwimlaneCanvas`](../../src/ui/TimelineView/SwimlaneView/SwimlaneCanvas/visual/) | event blocks, search highlight, measure, multi-height | `v930/entry`, `v930/search-highlight`, `v930/task-measure-mode`, `v930/task-multi-height` |
| [`EventTooltip`](../../src/ui/EventTooltip/visual/) | floating hover tooltip | `v930/task-hover` |
| ProfilingReport | (orchestration — no visual pack) | — |
| ReportLayout | (shell/resize — no visual pack) | — |
| TimelineView / SwimlaneView | (layout shells — no visual pack) | — |
