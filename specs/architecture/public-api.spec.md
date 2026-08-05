# Public API

<!--
  spec-id-prefix: none (architectural contract)
  phase: MVP
  source: src/index.ts
-->

Library public API surface consumed as `@huawei/profiling-report`. Vue is peer dependency (^3.5.0). Library builds as ESM and UMD with generated type declarations.

## Behavior

**Barrel exports (`import { X } from '@huawei/profiling-report'`).** `ProfilingReport` (Vue component), format loaders (`parseRep`, `adaptRep`, `loadReportSource`, `adaptChromeTrace`, `chromeTraceToSwimlane`), library identity (`LIBRARY_NAME`). All domain types re-exported via `export type *`.

**Deep imports** (available for advanced hosts that pre-process data). Domain helpers: `formatTime`, `formatAxisTime`, `formatCursorTime` (`src/domain/formatTime`), `t`, `resolveLocale` (`src/i18n`), `computeThreadUtilization`, `coveredLength`, `withDerivedUtilizations` (`src/domain/utilization`), `colorForThread`, `colorVarForLaneName`, `laneColorKey` (`src/domain/laneColors`), `createViewState`, `zoomToFitWindow`, `zoomAt`, `panBy`, `applyWindow` (`src/domain/viewState`). Renderer: `CanvasSwimlaneRenderer`, `LANE_GROUP_HEADER_HEIGHT`=28, `LANE_HEIGHT`=22 (`src/swimlane/CanvasSwimlaneRenderer`).

**Consumption patterns.** Hosts import `ProfilingReport` and format loaders from the barrel. Domain helpers (colors, utilization, view state) are available via deep imports for advanced hosts that pre-process data before passing as props.

## Dependencies

[ARCHITECTURE.md](../../docs/specs/architecture/ARCHITECTURE.md), [MSTT_INTEGRATION.md](../../docs/specs/architecture/MSTT_INTEGRATION.md).
