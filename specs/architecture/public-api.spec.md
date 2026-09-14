# Public API

Library public API surface consumed as `@huawei/profiling-report`. Vue is peer dependency (^3.5.0). Library builds as ESM and UMD with generated type declarations.

## Behavior

**Barrel exports (`import { X } from '@huawei/profiling-report'`).** `ProfilingReport` (Vue component), format loaders (`parseRep`, `adaptRep`, `loadReportSource`, `adaptChromeTrace`, `chromeTraceToSwimlane`), library identity (`LIBRARY_NAME`), dependency-depth helpers (`DEFAULT_DEPENDENCY_DEPTH`, `MAX_DEPENDENCY_DEPTH`, `normalizeDependencyDepth`), user-guide default URL (`DEFAULT_USER_GUIDE_URL`). All domain types re-exported via `export type *`.

**Deep imports** (available for local development and tests — public consumers import from `'@huawei/profiling-report'` only). Domain helpers: `formatTime`, `formatDisplayTime`, `formatDisplayTimeParts`, `formatAxisTime`, `formatCursorTime` (`src/domain/formatTime`), `t`, `resolveLocale` (`src/i18n`), `computeThreadUtilization`, `coveredLength`, `withDerivedUtilizations` (`src/domain/utilization`), `colorForThread`, `colorVarForLaneName`, `laneColorKey` (`src/domain/laneColors`), `createViewState`, `zoomToFitWindow`, `zoomAt`, `panBy`, `applyWindow` (`src/domain/viewState`). Renderer: `CanvasSwimlaneRenderer`, `LANE_GROUP_HEADER_HEIGHT`=28, `LANE_HEIGHT`=22 (`src/swimlane/CanvasSwimlaneRenderer`). Not available via `@huawei/profiling-report` imports — the `exports` map restricts JS to the barrel entry (plus the named host assets below).

**Package `exports` (host assets).** Beyond the barrel entry (`.`), the map exposes two files hosts must load outside the JS bundle:

- `./style.css` → `dist/profiling-report.css` — import as `@huawei/profiling-report/style.css`.
- `./memory-topology.svg` → `dist/memory-topology.svg` — copy/deploy as `@huawei/profiling-report/memory-topology.svg`. The library fetches it at the **web-root** path `/memory-topology.svg` (not bundle-relative), so hosts must serve that file at the site root. Sub-path embeds still need `/memory-topology.svg` at the domain root; a missing file leaves the topology chrome empty (panel warns and suppresses overlays — [MemoryTopologyPanel](../../src/ui/StatsAside/MemoryTopologyPanel/MemoryTopologyPanel.spec.md) PR-MEMTOP-012).

**Consumption patterns.** Hosts import `ProfilingReport` and format loaders from the barrel, import `style.css`, and serve `memory-topology.svg` at `/memory-topology.svg` (resolved from the package export for copy/deploy). Domain helpers (colors, utilization, view state) are available via deep imports for advanced hosts that pre-process data before passing as props.

**Component events.** `ProfilingReport` emits `ready`, `select`, `error`, `view-full-csv`, `open-hardware-details`, `open-pipe-details` (canonical set in [COMPONENTS.md](../../docs/architecture/COMPONENTS.md)). `select` tracks the **single** selection only: `null` means "no single selection" — it also fires when a marquee commit replaces the single selection with a multi-selection, so hosts must not read it as "nothing is selected" (contract: [ProfilingReport Outputs](../../src/ui/ProfilingReport/ProfilingReport.spec.md)). The marquee's `multi-select` / `multi-select-span` are internal child→root emits and the multi-select dock is self-contained; neither is part of the host-facing surface.

## Dependencies

[ARCHITECTURE.md](../../docs/architecture/ARCHITECTURE.md), [MSTT_INTEGRATION.md](../../docs/architecture/MSTT_INTEGRATION.md).

## Acceptance Criteria

*Architecture contracts — verified by integration tests and typecheck.*

## Changelog
- **2026-09-14** — Package `exports` document `./style.css` and `./memory-topology.svg`; hosts must serve the chrome at web-root `/memory-topology.svg`.
- **2026-09-07** — Re-export `DEFAULT_USER_GUIDE_URL` from barrel.
- **2026-08-27** — Component events documented: `select(null)` = "no single selection" (fires on a non-empty marquee commit too); `multi-select` / `multi-select-span` are internal, not host surface.
- **2026-08-18** — Re-export `DEFAULT_DEPENDENCY_DEPTH`, `MAX_DEPENDENCY_DEPTH`, `normalizeDependencyDepth` from barrel.
- **2026-08-05** — Initial spec. Core behaviors established.
