# Spec Index

This directory contains behavioral specifications for all modules in the profiling-report library.

## How to read

- Every spec describes what a module does, not how.
- Acceptance criteria are numbered and mapped to test IDs.
- Specs near components (in `src/ui/*/`, `src/swimlane/*/`) are the single source of truth for that component.
- Core and architecture specs live here in root `specs/`.

## Spec catalog

### Core (pure TypeScript)

| Spec | Test prefix | Phase | Source | Test file |
|------|------------|-------|--------|-----------|
| [rep-format](./core/rep-format.spec.md) | `PR-FMT-*` | MVP | `src/adapters/parseRep.ts` | `tests/unit/parseRep.spec.ts` |
| [input-formats](./core/input-formats.spec.md) | `PR-FMT-*` | MVP | `docs/formats/INPUT_FORMATS.md` | `tests/unit/parseRep.spec.ts` |
| [view-models](./core/view-models.spec.md) | `PR-VM-*` | MVP | `src/adapters/adaptRep.ts` | `tests/unit/viewModels.spec.ts` |
| [swimlane-model](./core/swimlane-model.spec.md) | `PR-SWIM-*` | MVP | `src/domain/types.ts` | `tests/unit/swimlaneModel.spec.ts` |
| [format-time](./core/format-time.spec.md) | `PR-TIME-*` | MVP | `src/domain/formatTime.ts` | `tests/unit/formatTime.spec.ts` |
| [view-state](./core/view-state.spec.md) | `PR-VIEW-*` | MVP | `src/domain/viewState.ts` | `tests/unit/viewState.spec.ts` |
| [swimlane-renderer](./core/swimlane-renderer.spec.md) | `PR-RENDER-*` | MVP | `src/swimlane/CanvasSwimlaneRenderer.ts` | `tests/unit/canvasRenderer.spec.ts` |
| [stress-swimlane](./core/stress-swimlane.spec.md) | `PR-STRESS-*` | Dev | `src/domain/generateStressSwimlane.ts` | `tests/unit/generateStressSwimlane.spec.ts` |
| [load-report-source](./core/load-report-source.spec.md) | `PR-JSON-*` | MVP | `src/adapters/loadReportSource.ts` | `tests/unit/loadReportSource.spec.ts` |
| [npu-rep](./core/npu-rep.spec.md) | `PR-NPU-*` | MVP | `src/adapters/parseNpuRep.ts`, `src/adapters/loadReportSource.ts` | `tests/unit/parseNpuRep.spec.ts`, `tests/unit/loadReportSource.spec.ts` |
| [utilization](./core/utilization.spec.md) | `PR-UTIL-*` | MVP | `src/domain/utilization.ts` | `tests/unit/utilization.spec.ts` |
| [integration](./core/integration.spec.md) | `PR-UI-*`, `PR-E2E-*` | MVP | — | `tests/component/ProfilingReport.feature.spec.ts`, `tests/e2e/feature.spec.ts` |
| [scaffold](./core/scaffold.spec.md) | `PR-SCAFFOLD-*` | MVP | — | `tests/unit/scaffold.spec.ts`, `tests/e2e/playground.spec.ts` |
| [cannbot-payload](./core/cannbot-payload.spec.md) | `PR-CANNBOT-*` | M2 | `src/domain/cannbot.ts` | `tests/unit/cannbot.spec.ts` |

### UI components (Vue SFCs)

Specs are co-located with their components.

| Component | Prefix | Phase | Location |
|-----------|--------|-------|----------|
| ProfilingReport | `PR-ROOT-*` | MVP | `src/ui/ProfilingReport/ProfilingReport.spec.md` |
| ReportToolbar | `PR-TOOLBAR-*` | MVP | `src/ui/ReportToolbar/ReportToolbar.spec.md` |
| TimelineView | `PR-TIMELINE-*` | MVP | `src/ui/TimelineView/TimelineView.spec.md` |
| TimeOverviewBar | `PR-OVERVIEW-*` | MVP | `src/ui/TimelineView/TimeOverviewBar/TimeOverviewBar.spec.md` |
| StatsAside | `PR-STATS-*` | MVP | `src/ui/StatsAside/StatsAside.spec.md` |
| ReportLayout | `PR-LAYOUT-*` | MVP | `src/ui/ReportLayout/ReportLayout.spec.md` |
| SwimlaneView | `PR-SWIMVIEW-*` | MVP | `src/ui/TimelineView/SwimlaneView/SwimlaneView.spec.md` |
| LaneGutter | `PR-GUTTER-*` | MVP | `src/ui/TimelineView/SwimlaneView/LaneGutter/LaneGutter.spec.md` |
| EventTooltip | `PR-TOOLTIP-*` | MVP | `src/ui/EventTooltip/EventTooltip.spec.md` |
| DetailPanel | `PR-DPANEL-*` | MVP | `src/ui/DetailPanel/DetailPanel.spec.md` |
| DetailSummary | `PR-DSUM-*` | MVP | `src/ui/DetailPanel/DetailSummary/DetailSummary.spec.md` |
| DetailParameter | `PR-DPARAM-*` | P2 stub | `src/ui/DetailPanel/DetailParameter/DetailParameter.spec.md` |
| DetailRelevant | `PR-DREL-*` | P2 stub | `src/ui/DetailPanel/DetailRelevant/DetailRelevant.spec.md` |
| CsvFieldListPanel | `PR-CSV-*` | M1 | `src/ui/StatsAside/CsvFieldListPanel/CsvFieldListPanel.spec.md` |
| RooflinePanel | `PR-ROOF-*` | M2 | `src/ui/StatsAside/RooflinePanel/RooflinePanel.spec.md` |
| HardwareDetailsPanel | `PR-HW-*` | M1 | `src/ui/StatsAside/HardwareDetailsPanel/HardwareDetailsPanel.spec.md` |
| SwimlaneCanvas | `PR-CANVAS-*` | MVP | `src/ui/TimelineView/SwimlaneView/SwimlaneCanvas/SwimlaneCanvas.spec.md` |
| MultiSelectSummary | `PR-MSEL-*` | P2 | `src/ui/MultiSelectSummary/MultiSelectSummary.vue`, `src/ui/MultiSelectSummary/MultiSelectSummary.spec.ts` |

### Architecture

| Spec | Phase | Source |
|------|-------|--------|
| [public-api](./architecture/public-api.spec.md) | MVP | `src/index.ts`, `docs/architecture/ARCHITECTURE.md` |
| [mstt-integration](./architecture/mstt-integration.spec.md) | MVP | `docs/architecture/MSTT_INTEGRATION.md` |

## Spec template

All spec files follow the standard template: [TEMPLATE.md](./TEMPLATE.md).

## Coverage verification

Run `node scripts/check-spec-coverage.mjs` to validate that every acceptance criterion in a spec has a corresponding test, and that every test references its spec.

## See also

- [docs/context/](../docs/context/) — project goals, domain, market, open questions, interim decisions
- [docs/process/](../docs/process/) — development process, testing strategy, definition of ready
- [docs/research/](../docs/research/) — research and architecture decision records
