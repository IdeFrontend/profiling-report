# Design asset index

Cross-layer map: **sources (v930) → component visual packs**. Pixel measures live in each component `{Name}.spec.md` **Visual** section (when present).

**Component tree (folders + packs):** [`src/ui/COMPONENT_TREE.md`](../../src/ui/COMPONENT_TREE.md).

## Layers

| Layer | Path | Role |
|-------|------|------|
| A – sources | [`source/v930/`](./source/v930/) + [`manifest.yaml`](./source/manifest.yaml) | Full-frame dumps (append-only) |
| C – visual packs | nested under `src/ui/{Region}/…/{Component}/visual/` | Crops + `provenance.yaml` next to implementation |

## Source frames (`v930`)

| Id | File | Typical consumers |
|----|------|-------------------|
| `v930/entry` | [`entry.jpeg`](./source/v930/entry.jpeg) | Toolbar, overview, gutter, swimlane, overview charts, axis |
| `v930/report-stats-open` | [`report-stats-open.jpeg`](./source/v930/report-stats-open.jpeg) | Stats summary, roofline |
| `v930/report-stats-scrolled` | [`report-stats-scrolled.jpeg`](./source/v930/report-stats-scrolled.jpeg) | Aside shell scroll |
| `v930/search-highlight` | [`search-highlight.jpeg`](./source/v930/search-highlight.jpeg) | Search highlight, cursor timestamp |
| `v930/detail-strip-raised` | [`detail-strip-raised.jpeg`](./source/v930/detail-strip-raised.jpeg) | Detail panel columns |
| `v930/compute-load` | [`compute-load.jpeg`](./source/v930/compute-load.jpeg) | PIPE occupancy |
| `v930/compute-load-detail` | [`compute-load-detail.jpeg`](./source/v930/compute-load-detail.jpeg) | Compute CSV fields |
| `v930/memory-load-detail` | [`memory-load-detail.jpeg`](./source/v930/memory-load-detail.jpeg) | Memory CSV field-list (详情) |
| `v930/hardware-more-detail` | [`hardware-more-detail.jpeg`](./source/v930/hardware-more-detail.jpeg) | Hardware details |
| `v930/task-hover` | [`task-hover.jpeg`](./source/v930/task-hover.jpeg) | Event tooltip |
| `v930/task-context-menu` | [`task-context-menu.jpeg`](./source/v930/task-context-menu.jpeg) | Context menu |
| `v930/task-marquee` | [`task-marquee.jpeg`](./source/v930/task-marquee.jpeg) | Marquee / multi-select |
| `v930/task-measure-mode` | [`task-measure-mode.jpeg`](./source/v930/task-measure-mode.jpeg) | Measure mode |
| `v930/task-multi-height` | [`task-multi-height.jpeg`](./source/v930/task-multi-height.jpeg) | Multi-task taller lanes |
| `v930/task-click-detail` | [`task-click-detail.jpeg`](./source/v930/task-click-detail.jpeg) | Task click → 详情 dock; other tasks 置灰; dep beziers |
| `v930/change-log` | [`change-log.jpeg`](./source/v930/change-log.jpeg) | Version change notes: measure mode, Cube\|Vector toggle, detail tabs, block switcher + 查看全部, buffer links |

## Component visual packs

| Component | Visual pack | Primary source |
|-----------|-------------|----------------|
| [`ReportToolbar`](../../src/ui/ReportToolbar/visual/) | toolbar, search, zoom, actions | `v930/entry` |
| [`TimeOverviewBar`](../../src/ui/TimelineView/TimeOverviewBar/visual/) | range handles | `v930/entry` |
| [`AxisRuler`](../../src/ui/TimelineView/TimeAxis/AxisRuler/visual/) | viewport ticks | `v930/entry` |
| [`CursorTimestamp`](../../src/ui/TimelineView/TimeAxis/CursorTimestamp/visual/) | cursor timestamp | `v930/search-highlight` |
| [`OverviewCharts`](../../src/ui/TimelineView/OverviewCharts/visual/) | 统计分析 tracks | `v930/entry` |
| [`LaneGutter`](../../src/ui/TimelineView/SwimlaneView/LaneGutter/visual/) | expanders, util bars | `v930/entry` |
| [`SwimlaneCanvas`](../../src/ui/TimelineView/SwimlaneView/SwimlaneCanvas/visual/) | events, search, measure, multi-height, marquee, selection-dim | `v930/entry`, `task-*` |
| [`DependencyLinksLayer`](../../src/ui/TimelineView/SwimlaneView/DependencyLinksLayer/visual/) | spec + visual pack; curves drawn by swimlane renderer (not a Vue overlay) | `v930/task-click-detail` |
| [`StatsAside`](../../src/ui/StatsAside/visual/) | aside shell scrolled | `v930/report-stats-scrolled` |
| [`StatsSummaryPanel`](../../src/ui/StatsAside/StatsSummaryPanel/visual/) | summary cards | `v930/report-stats-open` |
| [`PipeOccupancyPanel`](../../src/ui/StatsAside/PipeOccupancyPanel/visual/) | PIPE bars, Cube\|Vector tabs | `v930/compute-load` |
| [`CsvFieldListPanel`](../../src/ui/StatsAside/CsvFieldListPanel/visual/) | tabs, fields, block switcher | `v930/compute-load-detail`, `memory-load-detail` |
| [`RooflinePanel`](../../src/ui/StatsAside/RooflinePanel/visual/) | roofline chart | `v930/report-stats-open` |
| [`MemoryTopologyPanel`](../../src/ui/StatsAside/MemoryTopologyPanel/visual/) | memory topology SVG (nodes/edges) | `v930/report-stats-scrolled` |
| [`HardwareDetailsPanel`](../../src/ui/StatsAside/HardwareDetailsPanel/visual/) | Host/Device info | `v930/hardware-more-detail` |
| [`DetailPanel`](../../src/ui/DetailPanel/visual/) | dock chrome | `v930/detail-strip-raised` |
| [`DetailSummary`](../../src/ui/DetailPanel/DetailSummary/visual/) | identity card | `v930/detail-strip-raised` |
| [`DetailParameter`](../../src/ui/DetailPanel/DetailParameter/visual/) | Parameter list | `v930/detail-strip-raised` |
| [`DetailRelevant`](../../src/ui/DetailPanel/DetailRelevant/visual/) | Relevant graph | `v930/detail-strip-raised` |
| [`EventTooltip`](../../src/ui/EventTooltip/visual/) | hover tooltip | `v930/task-hover` |
| [`ContextMenu`](../../src/ui/ContextMenu/visual/) | task context menu | `v930/task-context-menu` |
| [`MultiSelectSummary`](../../src/ui/MultiSelectSummary/visual/) | selection, info panel | `v930/task-marquee` |
| ProfilingReport / ReportLayout / TimelineView / SwimlaneView / TimeAxis | (shells — no visual pack) | — |
