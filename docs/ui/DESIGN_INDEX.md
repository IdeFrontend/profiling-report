# Design asset index

Cross-layer map: **sources (v930) → component visual packs**. Pixel measures live in each component `{Name}.spec.md` **Visual** section (when present).

**UCD visual-review findings** (Ascend C / this library only): [`review/UI_REVIEW_FINDINGS.md`](./review/UI_REVIEW_FINDINGS.md) + [`review/screenshots/ascend-c/`](./review/screenshots/ascend-c/).

**Component tree (folders + packs):** [`src/ui/COMPONENT_TREE.md`](../../src/ui/COMPONENT_TREE.md).

## Layers

| Layer | Path | Role |
|-------|------|------|
| A – sources | [`source/930/`](./source/930/) + [`source/1130/`](./source/1130/) + [`manifest.yaml`](./source/manifest.yaml) | Per-screen Octo exports (arkUIDSL + screenshot + assets); legacy v930 dumps are superseded and removed |
| C – visual packs | nested under `src/ui/{Region}/…/{Component}/visual/` | Crops + `provenance.yaml` next to implementation |

A resolution-only replacement of an existing source id (same frame, higher resolution) may overwrite that file in place. A design change still gets a new batch.

## Source frames (`v930`)

The legacy 930 dumps (8K jpegs) are superseded by the 930 Octo export; the four scenes with no
export equivalent (fullscreen topology overlay, Source/SASS view, chrome SVG, roofline review
card) stay under [`930-legacy/`](./source/930-legacy/) and are linked below.
Every scene below links to its matched export screen (whole-frame image similarity +
semantics); `—` = no direct equivalent in the new export.

| Id | Current export (`930`) | Typical consumers |
|----|------------------------|-------------------|
| `v930/entry` | [`EntryPoint`](./source/930/EntryPoint/screenshot.png) | Toolbar, overview, gutter, swimlane, overview charts, axis |
| `v930/report-stats-open` | [`OpenReportStatistics`](./source/930/OpenReportStatistics/screenshot.png) | Stats summary, roofline |
| `v930/roofline-card-2026-10-15` | [legacy card](./source/930-legacy/v930/roofline-card-2026-10-15.png) — no export equivalent; roofline lives in `OpenReportStatistics` | Roofline review card (`RooflinePanel`) |
| `v930/report-stats-scrolled` | [`MemoryLoadAnalysisZoomFullscreenFromStats`](./source/930/MemoryLoadAnalysisZoomFullscreenFromStats/screenshot.png) | Aside shell scroll (historical dual-AIV topology dump — not current chrome) |
| `v930/search-highlight` | [`SearchHighlight`](./source/930/SearchHighlight/screenshot.png) | Search highlight, cursor timestamp |
| `v930/detail-strip-raised` | [`ClickFloatingBottomBar`](./source/930/ClickFloatingBottomBar/screenshot.png) | Detail panel columns |
| `v930/compute-load` | [`ComputeLoadAnalysis`](./source/930/ComputeLoadAnalysis/screenshot.png) | PIPE occupancy |
| `v930/compute-load-detail` | [`ComputeLoadAnalysisDetails`](./source/930/ComputeLoadAnalysisDetails/screenshot.png) | Compute CSV fields |
| `v930/memory-load-detail` | [`MemoryLoadAnalysisDetails`](./source/930/MemoryLoadAnalysisDetails/screenshot.png) | Memory CSV field-list (详情) |
| `v930/hardware-more-detail` | [`ReportStatisticsMoreHardwareInfo`](./source/930/ReportStatisticsMoreHardwareInfo/screenshot.png) | Hardware details; lane pin pushpin (Core2.Cube gutter) |
| `v930/task-hover` | [`TaskHover`](./source/930/TaskHover/screenshot.png) | Event tooltip |
| `v930/task-context-menu` | [`TaskContextMenu`](./source/930/TaskContextMenu/screenshot.png) | Context menu |
| `v930/task-marquee` | [`TaskSelectionBox`](./source/930/TaskSelectionBox/screenshot.png) | Marquee / multi-select |
| `v930/task-measure-mode` | [`TaskTimeMeasurementMode`](./source/930/TaskTimeMeasurementMode/screenshot.png) | Measure mode |
| `v930/task-multi-height` | [`MultipleTasksHeightIncreased`](./source/930/MultipleTasksHeightIncreased/screenshot.png) | Multi-task taller lanes |
| `v930/task-click-detail` | [`TaskClickedBottomBarOthersDimmed`](./source/930/TaskClickedBottomBarOthersDimmed/screenshot.png) | Task click → 详情 dock; other tasks 置灰; dep beziers |
| `v930/change-log` | [`ChangeLog`](./source/930/ChangeLog/screenshot.png) | Version change notes: measure mode, Cube\|Vector toggle, detail tabs, block switcher + 查看全部, buffer links |

## Source frames (`v930-sim` — 仿真)

| Id | Current export (`930`) | Typical consumers |
|----|------------------------|-------------------|
| `v930-sim/memory-topology-zoom` | [`MemoryLoadAnalysisZoomFullscreen`](./source/930/MemoryLoadAnalysisZoomFullscreen/screenshot.png) | 内存负载分析 zoom bar in the stacked aside (缩小 / % / 放大 / 适应窗口 / 全屏); clickable heat units (`L1` / `UB` / `L0A` / `L0B` / `L0C`, [UI-60](../context/decisions/UI.md)) — hover highlight, click opens that unit's heat panel |
| `v930-sim/memory-topology-fullscreen` | [legacy frame](./source/930-legacy/v930-sim/memory-topology-fullscreen.jpeg) — no fullscreen overlay in the 930 export | The same diagram in the root 全屏 overlay (zoom bar under the diagram column, left of heat; fit-window only, no 全屏, no strip) **plus** the §11.2.3.2 Memory Utilization Heatmap right panel: five unit tabs, two-state legend, block grid, capacity line |
| `v930-sim/performance-hints` | [`ReportPanelPerformanceTips`](./source/930/ReportPanelPerformanceTips/screenshot.png) | 性能提示 / 性能分析: title-row 性能分析 trigger (left of aside ×) + bottom hints table (Hint Message / Source Line / Instruction Address) |

## Source frames (`v930-source` — 源码)

| Id | Current export (`930`) | Typical consumers |
|----|------------------------|-------------------|
| `v930-source/source-correlation` | [legacy frame](./source/930-legacy/v930-source/source-correlation.jpeg) — no Source screen in the 930 export | [`SourceView`](../../src/ui/SourceView/visual/) — Source / SASS split. Timeline authority is `v930/entry` → `930/EntryPoint`. |

## Source frames (`v930-chrome` — official topology SVG)

| Id | Current export (`930`) | Typical consumers |
|----|------------------------|-------------------|
| `v930-chrome/memory-topology` | [legacy SVG](./source/930-legacy/v930-chrome/memory-topology.svg) — official chrome, still authoritative | Memory topology chrome (448×423, AIC + one AIV × 2); same asset as the runtime panel SVG |

<!-- design-screens:930:start -->
## Source frames (`930` — Octo/HDesign export)

Full-state screens with a machine-readable DSL, not plain jpegs: each folder under
[`source/930/`](./source/930/) holds `arkUIDSL.json` (node tree with absolute bboxes),
`screenshot.png`, a sanitized `index.html`, and shared assets in
[`source/930/_shared/assets/`](./source/930/_shared/assets/).
Work with them via the design-tools skill (`.agents/skills/design-tools/SKILL.md`):
`npm run design:find -- "<element>" docs/ui/source/930` to locate a UI element across screens,
`npm run design:render -- <Screen> docs/ui/source/930` /
`npm run design:diff -- <Screen> docs/ui/source/930` to render and compare with the screenshot.
`npm run design:sanitize -- <export.zip>` ingests a fresh export (extract, tailwind/fonts/margins,
lossless PNG/SVG optimization, asset dedupe, structural asset recovery, before/after
verification) — this section is regenerated by that command.

### Screens

| Folder | Design name | Screenshot | Assets |
|---|---|---|---|
| `AccountNotLoggedIn` | 账号未登录 | screenshot.png (1920×1080) | assets: 157 shared, 0 local |
| `AnomalyDetectionQuickOptionsDialog` | 异常检测快速选项-弹窗 | screenshot.png (1920×1080) | assets: 114 shared, 0 local |
| `CannBotActivated` | 06-CANNBot激活 | screenshot.png (1920×1080) | assets: 220 shared, 0 local |
| `CannBotNotInstalledPrompt` | 未安装CANNBot提示 | screenshot.png (1920×1080) | assets: 223 shared, 0 local |
| `ChangeLog` | 变更记录 | screenshot.png (1920×1080) | assets: 5 shared, 0 local |
| `ClickAI` | 点击AI | screenshot.png (1920×1080) | assets: 160 shared, 0 local |
| `ClickFloatingBottomBar` | 点击上浮底部栏 | screenshot.png (1920×1080) | assets: 224 shared, 0 local |
| `ComputeLoadAnalysis` | 计算负载分析 | screenshot.png (854×1080) | assets: 20 shared, 0 local |
| `ComputeLoadAnalysisDetails` | 点击计算负载分析的详情后 | screenshot.png (1920×1080) | assets: 247 shared, 0 local |
| `DataCollectionConfigDialog` | 数据采集配置（弹窗） | screenshot.png (1920×1080) | assets: 127 shared, 0 local |
| `EntryPoint` | 入口 | screenshot.png (1920×1080) | assets: 285 shared, 0 local |
| `InteractionGuide` | 交互说明 | screenshot.png (1735×2555) | assets: 42 shared, 0 local |
| `MemoryLoadAnalysisDetails` | 点击内存负载分析的详情后 | screenshot.png (1920×1080) | assets: 225 shared, 25 local |
| `MemoryLoadAnalysisZoomFullscreen` | 内存负载分析缩放+全屏 | screenshot.png (1920×1080) | assets: 318 shared, 0 local |
| `MemoryLoadAnalysisZoomFullscreenFromStats` | 内存负载分析缩放+全屏 | screenshot.png (1920×1080) | assets: 268 shared, 50 local |
| `MultipleTasksHeightIncreased` | Task 存在多个时，高度加高 | screenshot.png (1920×1080) | assets: 253 shared, 10 local |
| `OpenReportStatistics` | 打开报告统计 | screenshot.png (1920×1080) | assets: 243 shared, 23 local |
| `Pinned` | 置顶后 | screenshot.png (1920×1080) | assets: 294 shared, 9 local |
| `Reference` | 引用 | screenshot.png (1920×1080) | assets: 166 shared, 0 local |
| `ReportPanelInitiate` | 05-报告面板-发起 | screenshot.png (996×2111) | assets: 78 shared, 3 local |
| `ReportPanelInitiateLegacy` | 05报告面板-发起 | screenshot.png (1970×1564) | assets: 55 shared, 0 local |
| `ReportPanelPerformanceTips` | 报告面板-性能提示 | screenshot.png (1920×1080) | assets: 204 shared, 0 local |
| `ReportPanelPerformanceTipsNoCards` | 报告面板-性能提示（报告无卡片时） | screenshot.png (1920×1080) | assets: 124 shared, 74 local |
| `ReportStatisticsMoreHardwareInfo` | 点击报告统计右边的更多后-硬件信息详情 | screenshot.png (1920×1080) | assets: 241 shared, 21 local |
| `SearchHighlight` | 搜索高亮显示 | screenshot.png (1920×1080) | assets: 202 shared, 46 local |
| `SwimlaneTriggerContextMenu` | 03-泳道区-触发-右键 | screenshot.png (1920×1080) | assets: 245 shared, 0 local |
| `SwimlaneTriggerHover` | 01-泳道区-触发-Hover | screenshot.png (1920×1080) | assets: 218 shared, 0 local |
| `SwimlaneTriggerHoverClickAnalyze` | 02-泳道区-触发-Hover-点击分析 | screenshot.png (1920×1080) | assets: 207 shared, 2 local |
| `SwimlaneTriggerSelectionBox` | 04-泳道区-触发-框选 | screenshot.png (1920×1080) | assets: 222 shared, 7 local |
| `TaskClickedBottomBarOthersDimmed` | Task 点击后-出现底部栏、其他task置灰 | screenshot.png (1920×1080) | assets: 148 shared, 98 local |
| `TaskContextMenu` | Task 右键时 | screenshot.png (1920×1080) | assets: 136 shared, 129 local |
| `TaskHover` | Task 悬浮时 | screenshot.png (1920×1080) | assets: 200 shared, 68 local |
| `TaskSelectionBox` | Task 框选时 | screenshot.png (1920×1080) | assets: 126 shared, 135 local |
| `TaskTimeMeasurementMode` | Task 时间度量模式 | screenshot.png (1920×1080) | assets: 204 shared, 61 local |

### Known export gaps

Screens with remaining missing assets or screenshots (structure-based recovery already
applied) — excluded from render/diff until re-exported:

| Folder | Note |
|---|---|
| — | none |

<!-- design-screens:930:end -->

<!-- design-screens:1130:start -->
## Source frames (`1130` — Octo/HDesign export)

Full-state screens with a machine-readable DSL, not plain jpegs: each folder under
[`source/1130/`](./source/1130/) holds `arkUIDSL.json` (node tree with absolute bboxes),
`screenshot.png`, a sanitized `index.html`, and shared assets in
[`source/1130/_shared/assets/`](./source/1130/_shared/assets/).
Work with them via the design-tools skill (`.agents/skills/design-tools/SKILL.md`):
`npm run design:find -- "<element>" docs/ui/source/1130` to locate a UI element across screens,
`npm run design:render -- <Screen> docs/ui/source/1130` /
`npm run design:diff -- <Screen> docs/ui/source/1130` to render and compare with the screenshot.
`npm run design:sanitize -- <export.zip>` ingests a fresh export (extract, tailwind/fonts/margins,
lossless PNG/SVG optimization, asset dedupe, structural asset recovery, before/after
verification) — this section is regenerated by that command.

### Screens

| Folder | Design name | pageId | Screenshot | Assets |
|---|---|---|---|---|
| `AnalysisDoneWithView` | 4-分析完成带查看 | 1294172 | screenshot.png (1920×1080) | assets: 232 shared, 0 local |
| `AnalyzingOne` | 1-点击正在分析一个 | 1294173 | screenshot.png (1920×1080) | assets: 174 shared, 56 local |
| `AnalyzingTwo` | 2-同时分析两个 | 1294171 | screenshot.png (1920×1080) | assets: 219 shared, 10 local |
| `BaselineAddAndSelectGuide` | 添加基线和选择基线操作说明 | 1318646 | screenshot.png (3707×2047) | assets: 326 shared, 0 local |
| `BaselineAddedWithCurrentReport` | 已添加基线-包含当前报告 | 1318650 | screenshot.png (1920×1080) | assets: 262 shared, 0 local |
| `BaselineAddedWithoutCurrentReport` | 已添加基线-不包含当前报告 | 1318645 | screenshot.png (1920×1080) | assets: 243 shared, 18 local |
| `BaselineInProgressCancelCompare` | 正在进行基线-取消对比 | 1318647 | screenshot.png (1920×1080) | assets: 256 shared, 8 local |
| `CannWorkButtonIdle` | CANNWork未唤起按钮状态 | 1287863 | screenshot.png (1920×1080) | assets: 226 shared, 29 local |
| `CannWorkInvokedLoggedIn` | CANNWork唤起(已登录) | 1287865 | screenshot.png (1920×1080) | assets: 187 shared, 51 local |
| `CannWorkInvokedLoggedOut` | CANNWork唤起(未登录) | 1287864 | screenshot.png (1920×1080) | assets: 170 shared, 56 local |
| `ContactIconDialogAI` | 触点图标（对话+ai） | 1294170 | screenshot.png (1920×1080) | assets: 255 shared, 0 local |
| `ContextReference` | 上下文引用 | 1307882 | screenshot.png (1920×1080) | assets: 243 shared, 0 local |
| `DocumentSearch` | 搜索文档 | 1307395 | screenshot.png (1920×1080) | assets: 216 shared, 0 local |
| `MultipleStreamsMerged` | 多个流合并 | 1208281 | screenshot.png (1920×1080) | assets: 276 shared, 0 local |
| `NoBaseline` | 未添加任何基线 | 1318649 | screenshot.png (1920×1080) | assets: 170 shared, 78 local |
| `PerformanceOverview` | 概览页面 | 1314533 | screenshot.png (1920×1080) | assets: 40 shared, 0 local |
| `PipelineDisplayFilter` | 流水显示筛选 | 1307396 | screenshot.png (1920×1080) | assets: 258 shared, 1 local |
| `ReferenceInvoked` | 引用（已唤起cannwork，在输入框使用#快捷引用） | 1287868 | screenshot.png (1920×1080) | assets: 242 shared, 0 local |
| `ReferenceNotInvoked` | 引用（未唤起cannwork，只能在报告触发点触发引用） | 1287866 | screenshot.png (1920×1080) | assets: 254 shared, 4 local |
| `RooflineThroughput` | Roofline-Throughput | 1329940 | screenshot.png (1446×1728) | assets: 161 shared, 0 local |
| `RunOptimizationButton` | 执行优化（报告统计右上角增加执行优化按钮） | 1287862 | screenshot.png (1920×1080) | assets: 250 shared, 5 local |
| `RunOptimizationInvoke` | 执行优化唤起 | 1287861 | screenshot.png (1920×1080) | assets: 208 shared, 23 local |
| `SecondReportTabOpened` | 打开第二份报告页签 | 1318648 | screenshot.png (1920×1080) | assets: 206 shared, 56 local |
| `SourceCodeCompare` | 源码对比 | 1314530 | screenshot.png (1920×1080) | assets: 175 shared, 0 local |
| `SourceCodeCompareFromTab` | 从源码页签进入源码对比 | 1314531 | screenshot.png (1920×1080) | assets: 180 shared, 2 local |
| `StopAnalyzingOne` | 3-停止分析一个 | 1294174 | screenshot.png (1920×1080) | assets: 157 shared, 73 local |

### Known export gaps

Screens with remaining missing assets or screenshots (structure-based recovery already
applied) — excluded from render/diff until re-exported:

| Folder | Note |
|---|---|
| — | none |

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

