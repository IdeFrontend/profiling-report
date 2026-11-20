# Design asset index

Cross-layer map: **sources (v930) → component visual packs**. Pixel measures live in each component `{Name}.spec.md` **Visual** section (when present).

**UCD visual-review findings** (Ascend C / this library only): [`review/UI_REVIEW_FINDINGS.md`](./review/UI_REVIEW_FINDINGS.md) + [`review/screenshots/ascend-c/`](./review/screenshots/ascend-c/).

**Component tree (folders + packs):** [`src/ui/COMPONENT_TREE.md`](../../src/ui/COMPONENT_TREE.md).

## Layers

| Layer | Path | Role |
|-------|------|------|
| A – sources | [`source/v930/`](./source/v930/) + [`source/v930-sim/`](./source/v930-sim/) + [`source/v930-chrome/`](./source/v930-chrome/) + [`source/v930-source/`](./source/v930-source/) + [`manifest.yaml`](./source/manifest.yaml) | Full-frame dumps (append-only) |
| C – visual packs | nested under `src/ui/{Region}/…/{Component}/visual/` | Crops + `provenance.yaml` next to implementation |

A resolution-only replacement of an existing source id (same frame, higher resolution) may overwrite that file in place. A design change still gets a new batch.

## Source frames (`v930`)

| Id | File | Typical consumers |
|----|------|-------------------|
| `v930/entry` | [`entry.jpeg`](./source/v930/entry.jpeg) | Toolbar, overview, gutter, swimlane, overview charts, axis |
| `v930/report-stats-open` | [`report-stats-open.jpeg`](./source/v930/report-stats-open.jpeg) | Stats summary, roofline |
| `v930/report-stats-scrolled` | [`report-stats-scrolled.jpeg`](./source/v930/report-stats-scrolled.jpeg) | Aside shell scroll (historical dual-AIV topology dump — not current chrome) |
| `v930/search-highlight` | [`search-highlight.jpeg`](./source/v930/search-highlight.jpeg) | Search highlight, cursor timestamp |
| `v930/detail-strip-raised` | [`detail-strip-raised.jpeg`](./source/v930/detail-strip-raised.jpeg) | Detail panel columns |
| `v930/compute-load` | [`compute-load.jpeg`](./source/v930/compute-load.jpeg) | PIPE occupancy |
| `v930/compute-load-detail` | [`compute-load-detail.jpeg`](./source/v930/compute-load-detail.jpeg) | Compute CSV fields |
| `v930/memory-load-detail` | [`memory-load-detail.jpeg`](./source/v930/memory-load-detail.jpeg) | Memory CSV field-list (详情) |
| `v930/hardware-more-detail` | [`hardware-more-detail.jpeg`](./source/v930/hardware-more-detail.jpeg) | Hardware details; lane pin pushpin (Core2.Cube gutter) |
| `v930/task-hover` | [`task-hover.jpeg`](./source/v930/task-hover.jpeg) | Event tooltip |
| `v930/task-context-menu` | [`task-context-menu.jpeg`](./source/v930/task-context-menu.jpeg) | Context menu |
| `v930/task-marquee` | [`task-marquee.jpeg`](./source/v930/task-marquee.jpeg) | Marquee / multi-select |
| `v930/task-measure-mode` | [`task-measure-mode.jpeg`](./source/v930/task-measure-mode.jpeg) | Measure mode |
| `v930/task-multi-height` | [`task-multi-height.jpeg`](./source/v930/task-multi-height.jpeg) | Multi-task taller lanes |
| `v930/task-click-detail` | [`task-click-detail.jpeg`](./source/v930/task-click-detail.jpeg) | Task click → 详情 dock; other tasks 置灰; dep beziers |
| `v930/change-log` | [`change-log.jpeg`](./source/v930/change-log.jpeg) | Version change notes: measure mode, Cube\|Vector toggle, detail tabs, block switcher + 查看全部, buffer links |

## Source frames (`v930-sim` — 仿真)

| Id | File | Typical consumers |
|----|------|-------------------|
| `v930-sim/memory-topology-zoom` | [`memory-topology-zoom.jpeg`](./source/v930-sim/memory-topology-zoom.jpeg) | 内存负载分析 zoom bar in the stacked aside (缩小 / % / 放大 / 适应窗口 / 全屏); clickable heat units (`L1` / `UB` / `L0A` / `L0B` / `L0C`, [UI-60](../context/decisions/UI.md)) — hover highlight, click opens that unit's heat panel |
| `v930-sim/memory-topology-fullscreen` | [`memory-topology-fullscreen.jpeg`](./source/v930-sim/memory-topology-fullscreen.jpeg) | The same diagram in the root 全屏 overlay (zoom bar under the diagram column, left of heat; fit-window only, no 全屏, no strip) **plus** the §11.2.3.2 Memory Utilization Heatmap right panel: five unit tabs, two-state legend, block grid, capacity line |
| `v930-sim/performance-hints` | [`performance-hints.jpeg`](./source/v930-sim/performance-hints.jpeg) | 性能提示 / 性能分析: title-row 性能分析 trigger (left of aside ×) + bottom hints table (Hint Message / Source Line / Instruction Address) |

## Source frames (`v930-source` — 源码)

| Id | File | Typical consumers |
|----|------|-------------------|
| `v930-source/source-correlation` | [`source-correlation.jpeg`](./source/v930-source/source-correlation.jpeg) | [`SourceView`](../../src/ui/SourceView/visual/) — Source / SASS split. Timeline authority stays `v930/entry`. |

## Source frames (`v930-chrome` — official topology SVG)

| Id | File | Typical consumers |
|----|------|-------------------|
| `v930-chrome/memory-topology` | [`memory-topology.svg`](./source/v930-chrome/memory-topology.svg) | Memory topology chrome (448×423, AIC + one AIV × 2); same asset as the runtime panel SVG |

<!-- design-screens:1130:start -->
## Source frames (`1130` — Octo/HDesign export)

Full-state screens with a machine-readable DSL, not plain jpegs: each folder under
[`source/1130/`](./source/1130/) holds `arkUIDSL.json` (node tree with absolute bboxes),
`screenshot.png`, a sanitized `index.html`, and shared assets in
[`source/1130/_shared/assets/`](./source/1130/_shared/assets/).
Work with them via the design-tools skill (`.agents/skills/design-tools/SKILL.md`):
`npm run design:find -- "<element>"` to locate a UI element across screens,
`npm run design:render -- <Screen>` / `design:diff` to render and compare with the screenshot.
`npm run design:sanitize -- <export.zip>` ingests a fresh export (extract, tailwind/fonts/margins,
lossless PNG/SVG optimization, asset dedupe, structural asset recovery, before/after
verification) — this section is regenerated by that command.

### Screens

| Folder | Design name | pageId | Screenshot | Assets |
|---|---|---|---|
| `AnalysisDoneWithView` | 4-分析完成带查看 | 1294172 | screenshot.png (1920×1080) | assets: 232 shared, 0 local |
| `AnalyzingOne` | 1-点击正在分析一个 | 1294173 | screenshot.png (1920×1080) | assets: 174 shared, 56 local |
| `AnalyzingTwo` | 2-同时分析两个 | 1294171 | screenshot.png (1920×1080) | assets: 219 shared, 10 local |
| `BaselineAddAndSelectGuide` | 添加基线和选择基线操作说明 | 1318646 | screenshot.png (2906×1851) | assets: 195 shared, 0 local |
| `BaselineAddedWithCurrentReport` | 已添加基线-包含当前报告 | 1318650 | screenshot.png (1920×1080) | assets: 262 shared, 2 local |
| `BaselineAddedWithoutCurrentReport` | 已添加基线-不包含当前报告 | 1318645 | screenshot.png (1920×1080) | assets: 250 shared, 13 local |
| `BaselineInProgressCancelCompare` | 正在进行基线-取消对比 | 1318647 | screenshot.png (1920×1080) | assets: 268 shared, 0 local |
| `CannWorkButtonIdle` | CANNWork未唤起按钮状态 | 1287863 | screenshot.png (1920×1080) | assets: 226 shared, 29 local |
| `CannWorkInvokedLoggedIn` | CANNWork唤起(已登录) | 1287865 | screenshot missing | assets: 228 shared, 0 local |
| `CannWorkInvokedLoggedOut` | CANNWork唤起(未登录) | 1287864 | screenshot missing | assets: 217 shared, 0 local |
| `ContactIconDialogAI` | 触点图标（对话+ai） | 1294170 | screenshot.png (1920×1080) | assets: 255 shared, 0 local |
| `ContextReference` | 上下文引用 | 1307882 | screenshot invalid (removed) | assets: 222 shared, 0 local |
| `DocumentSearch` | 搜索文档 | 1307395 | screenshot missing | assets: 197 shared, 0 local |
| `MultipleStreamsMerged` | 多个流合并 | 1208281 | screenshot.png (1920×1080) | assets: 276 shared, 0 local |
| `NoBaseline` | 未添加任何基线 | 1318649 | screenshot.png (1920×1080) | assets: 244 shared, 6 local |
| `PerformanceOverview` | 概览页面 | 1314533 | screenshot.png (1920×1080) | assets: 40 shared, 0 local |
| `PipelineDisplayFilter` | 流水显示筛选 | 1307396 | screenshot.png (1920×1080) | assets: 259 shared, 0 local |
| `ReferenceInvoked` | 引用（已唤起cannwork，在输入框使用#快捷引用） | 1287868 | screenshot invalid (removed) | assets: 223 shared, 0 local |
| `ReferenceNotInvoked` | 引用（未唤起cannwork，只能在报告触发点触发引用） | 1287866 | screenshot.png (1920×1080) | assets: 254 shared, 4 local |
| `RunOptimizationButton` | 执行优化（报告统计右上角增加执行优化按钮） | 1287862 | screenshot.png (1920×1080) | assets: 250 shared, 5 local |
| `RunOptimizationInvoke` | 执行优化唤起 | 1287861 | screenshot.png (1920×1080) | assets: 209 shared, 22 local |
| `SecondReportTabOpened` | 打开第二份报告页签 | 1318648 | screenshot.png (1920×1080) | assets: 244 shared, 20 local |
| `SourceCodeCompare` | 源码对比 | 1314530 | screenshot.png (1920×1080) | assets: 175 shared, 0 local |
| `SourceCodeCompareFromTab` | 从源码页签进入源码对比 | 1314531 | screenshot.png (1920×1080) | assets: 180 shared, 2 local |
| `StopAnalyzingOne` | 3-停止分析一个 | 1294174 | screenshot.png (1920×1080) | assets: 169 shared, 61 local |

### Known export gaps

Screens with remaining missing assets or screenshots (structure-based recovery already
applied) — excluded from render/diff until re-exported:

| Folder | Note |
|---|---|
| `CannWorkInvokedLoggedIn` | 10 broken refs, 0 assets on disk; no screenshot |
| `CannWorkInvokedLoggedOut` | 9 broken refs, 0 assets on disk; no screenshot |
| `ContextReference` | 21 broken refs, 0 assets on disk; invalid screenshot removed (262×439 popup crop) |
| `DocumentSearch` | 19 broken refs, 0 assets on disk; no screenshot |
| `ReferenceInvoked` | 19 broken refs, 0 assets on disk; invalid screenshot removed (262×439 popup crop) |

<!-- design-screens:1130:end -->

## Component visual packs

| Component | Visual pack | Primary source |
|-----------|-------------|----------------|
| [`ReportToolbar`](../../src/ui/ReportToolbar/visual/) | toolbar, search, zoom, actions | `v930/entry` |
| [`TimeOverviewBar`](../../src/ui/TimelineView/TimeOverviewBar/visual/) | range handles | `v930/entry` |
| [`AxisRuler`](../../src/ui/TimelineView/TimeAxis/AxisRuler/visual/) | viewport ticks | `v930/entry` |
| [`CursorTimestamp`](../../src/ui/TimelineView/TimeAxis/CursorTimestamp/visual/) | cursor timestamp | `v930/search-highlight` |
| [`OverviewCharts`](../../src/ui/TimelineView/OverviewCharts/visual/) | 统计分析 tracks | `v930/entry` |
| [`LaneGutter`](../../src/ui/TimelineView/SwimlaneView/LaneGutter/visual/) | expanders, util bars | `v930/entry`; **pin** crops → `v930/hardware-more-detail` |
| [`SwimlaneView`](../../src/ui/TimelineView/SwimlaneView/visual/) | Card metric dropdown | `v930/entry` |
| [`SwimlaneCanvas`](../../src/ui/TimelineView/SwimlaneView/SwimlaneCanvas/visual/) | events, search, measure, multi-height, marquee, selection-dim | `v930/entry`, `task-*` |
| [`DependencyLinksLayer`](../../src/ui/TimelineView/SwimlaneView/DependencyLinksLayer/visual/) | spec + visual pack; curves drawn by swimlane renderer (not a Vue overlay) | `v930/task-click-detail` |
| [`StatsAside`](../../src/ui/StatsAside/visual/) | aside shell scrolled | `v930/report-stats-scrolled` |
| [`StatsSummaryPanel`](../../src/ui/StatsAside/StatsSummaryPanel/visual/) | summary cards | `v930/report-stats-open` |
| [`PipeOccupancyPanel`](../../src/ui/StatsAside/PipeOccupancyPanel/visual/) | PIPE bars, Cube\|Vector tabs | `v930/compute-load` |
| [`CsvFieldListPanel`](../../src/ui/StatsAside/CsvFieldListPanel/visual/) | tabs, fields, block switcher | `v930/compute-load-detail`, `memory-load-detail` |
| [`RooflinePanel`](../../src/ui/StatsAside/RooflinePanel/visual/) | roofline chart | `v930/report-stats-open` |
| [`MemoryTopologyPanel`](../../src/ui/StatsAside/MemoryTopologyPanel/visual/) | memory topology chrome (nodes/edges) + value slots; zoom / fullscreen bar; clickable unit hit boxes | `v930-chrome/memory-topology` (SVG); bar → `v930-sim/*` |
| [`MemoryHeatmapPanel`](../../src/ui/StatsAside/MemoryHeatmapPanel/visual/) | §11.2.3.2 heat panel: unit tabs, view-bar, two-state legend, Layout lattice, `Total / Used / Free` | `v930-sim/memory-topology-fullscreen` |
| [`HardwareDetailsPanel`](../../src/ui/StatsAside/HardwareDetailsPanel/visual/) | Host/Device info | `v930/hardware-more-detail` |
| [`DetailPanel`](../../src/ui/DetailPanel/visual/) | dock chrome | `v930/detail-strip-raised` |
| [`DetailSummary`](../../src/ui/DetailPanel/DetailSummary/visual/) | identity card | `v930/detail-strip-raised` |
| [`DetailParameter`](../../src/ui/DetailPanel/DetailParameter/visual/) | Parameter list | `v930/detail-strip-raised` |
| [`DetailRelevant`](../../src/ui/DetailPanel/DetailRelevant/visual/) | Relevant graph | `v930/detail-strip-raised` |
| [`EventTooltip`](../../src/ui/EventTooltip/visual/) | hover tooltip | `v930/task-hover` |
| [`ContextMenu`](../../src/ui/ContextMenu/visual/) | task context menu | `v930/task-context-menu` |
| [`MultiSelectSummary`](../../src/ui/MultiSelectSummary/visual/) | selection, info panel | `v930/task-marquee` |
| [`SourceView`](../../src/ui/SourceView/visual/) | Source / SASS correlation | `v930-source/source-correlation` |
| ProfilingReport / ReportLayout / TimelineView / TimeAxis | (shells — no visual pack) | — |
