# Public API

Library public API surface consumed as `@huawei/profiling-report`. Vue is peer dependency (^3.5.0). Library builds as ESM and UMD with generated type declarations.

## Behavior

**Barrel exports (`import { X } from '@huawei/profiling-report'`).** `ProfilingReport` (Vue component), format loaders (`parseRep`, `adaptRep`, `loadReportSource`, `adaptChromeTrace`, `chromeTraceToSwimlane`), library identity (`LIBRARY_NAME`), dependency-depth helpers (`DEFAULT_DEPENDENCY_DEPTH`, `MAX_DEPENDENCY_DEPTH`, `normalizeDependencyDepth`). All domain types re-exported via `export type *`.

**Deep imports** (available for local development and tests — public consumers import from `'@huawei/profiling-report'` only). Domain helpers: `formatTime`, `formatDisplayTime`, `formatDisplayTimeParts`, `formatAxisTime`, `formatCursorTime` (`src/domain/formatTime`), `t`, `resolveLocale` (`src/i18n`), `computeThreadUtilization`, `coveredLength`, `withDerivedUtilizations` (`src/domain/utilization`), `colorForThread`, `colorVarForLaneName`, `laneColorKey` (`src/domain/laneColors`), `createViewState`, `zoomToFitWindow`, `zoomAt`, `panBy`, `applyWindow` (`src/domain/viewState`). Renderer: `CanvasSwimlaneRenderer`, `LANE_GROUP_HEADER_HEIGHT`=28, `LANE_HEIGHT`=22 (`src/swimlane/CanvasSwimlaneRenderer`). Not available via `@huawei/profiling-report` imports — the `exports` map restricts to the barrel entry.

**Consumption patterns.** Hosts import `ProfilingReport` and format loaders from the barrel. Domain helpers (colors, utilization, view state) are available via deep imports for advanced hosts that pre-process data before passing as props.

**Component events.** `ProfilingReport` emits `ready`, `select`, `error`, `view-full-csv`, `open-hardware-details`, `open-pipe-details` (canonical set in [COMPONENTS.md](../../docs/architecture/COMPONENTS.md)). `select` tracks the **single** selection only: `null` means "no single selection" — it also fires when a marquee commit replaces the single selection with a multi-selection, so hosts must not read it as "nothing is selected" (contract: [ProfilingReport Outputs](../../src/ui/ProfilingReport/ProfilingReport.spec.md)). The marquee's `multi-select` / `multi-select-span` are internal child→root emits and the multi-select dock is self-contained; neither is part of the host-facing surface.

## Dependencies

[ARCHITECTURE.md](../../docs/architecture/ARCHITECTURE.md), [MSTT_INTEGRATION.md](../../docs/architecture/MSTT_INTEGRATION.md).

## Acceptance Criteria

*Architecture contracts — verified by integration tests and typecheck.*

## Changelog
- **2026-08-27** — Component events documented: `select(null)` = "no single selection" (fires on a non-empty marquee commit too); `multi-select` / `multi-select-span` are internal, not host surface.
- **2026-08-18** — Re-export `DEFAULT_DEPENDENCY_DEPTH`, `MAX_DEPENDENCY_DEPTH`, `normalizeDependencyDepth` from barrel.
- **2026-08-05** — Initial spec. Core behaviors established.
