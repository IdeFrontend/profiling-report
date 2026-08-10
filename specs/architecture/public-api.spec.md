# Public API

Library public API surface consumed as `@huawei/profiling-report`. Vue is peer dependency (^3.5.0). Library builds as ESM and UMD with generated type declarations.

## Behavior

**Barrel exports (`import { X } from '@huawei/profiling-report'`).** `ProfilingReport` (Vue component), format loaders (`parseRep`, `adaptRep`, `loadReportSource`, `adaptChromeTrace`, `chromeTraceToSwimlane`), library identity (`LIBRARY_NAME`). All domain types re-exported via `export type *`.

**Deep imports** (available for local development and tests — public consumers import from `'@huawei/profiling-report'` only). Domain helpers: `formatTime`, `formatAxisTime`, `formatCursorTime` (`src/domain/formatTime`), `t`, `resolveLocale` (`src/i18n`), `computeThreadUtilization`, `coveredLength`, `withDerivedUtilizations` (`src/domain/utilization`), `colorForThread`, `colorVarForLaneName`, `laneColorKey` (`src/domain/laneColors`), `createViewState`, `zoomToFitWindow`, `zoomAt`, `panBy`, `applyWindow` (`src/domain/viewState`). Renderer: `CanvasSwimlaneRenderer`, `LANE_GROUP_HEADER_HEIGHT`=28, `LANE_HEIGHT`=22 (`src/swimlane/CanvasSwimlaneRenderer`). Not available via `@huawei/profiling-report` imports — the `exports` map restricts to the barrel entry.

**Consumption patterns.** Hosts import `ProfilingReport` and format loaders from the barrel. Domain helpers (colors, utilization, view state) are available via deep imports for advanced hosts that pre-process data before passing as props.

## Dependencies

[ARCHITECTURE.md](../../docs/architecture/ARCHITECTURE.md), [MSTT_INTEGRATION.md](../../docs/architecture/MSTT_INTEGRATION.md).

## Acceptance Criteria

*Architecture contracts — verified by integration tests and typecheck.*

## Changelog
- **2026-08-05** — Initial spec. Core behaviors established.
