# Public API

Library public API surface consumed as `@huawei/profiling-report`. Vue is peer dependency (^3.5.0). Library builds as ESM and UMD with generated type declarations.

## Behavior

**Barrel exports (`import { X } from '@huawei/profiling-report'`).** `ProfilingReport` (Vue component), format loaders (`parseRep`, `adaptRep`, `loadReportSource`, `adaptChromeTrace`, `chromeTraceToSwimlane`), library identity (`LIBRARY_NAME`). All domain types re-exported via `export type *`.

**Deep imports** (available for local development and tests — public consumers import from `'@huawei/profiling-report'` only). Domain helpers: `formatTime`, `formatAxisTime`, `formatCursorTime` (`src/domain/formatTime`), `t`, `resolveLocale` (`src/i18n`), `computeThreadUtilization`, `coveredLength`, `withDerivedUtilizations` (`src/domain/utilization`), `colorForThread`, `colorVarForLaneName`, `laneColorKey` (`src/domain/laneColors`), `createViewState`, `zoomToFitWindow`, `zoomAt`, `panBy`, `applyWindow` (`src/domain/viewState`). Renderer: `CanvasSwimlaneRenderer`, `LANE_GROUP_HEADER_HEIGHT`=28, `LANE_HEIGHT`=22 (`src/swimlane/CanvasSwimlaneRenderer`). Not available via `@huawei/profiling-report` imports — the `exports` map restricts to the barrel entry.

**Consumption patterns.** Hosts import `ProfilingReport` and format loaders from the barrel. Domain helpers (colors, utilization, view state) are available via deep imports for advanced hosts that pre-process data before passing as props.

**`ProfilingReport` props.** `title?: string`; `source?: ArrayBuffer | Uint8Array`; `swimlaneModel?: SwimlaneModel`; `reportModel?: ReportViewModel`; `theme?: 'light' | 'dark'` (default `'dark'`); `locale?: string` (default `'zh-CN'`); `timeUnit?: 'ms' | 'us' | 'ns'` (default `'ms'`); `preferRenderer?: 'auto' | 'webgl' | 'canvas'` (default `'auto'`); `capabilities?: ReportCapability[]` (default `[]`).

**`ProfilingReport` emits.** `ready: []`; `select: [SelectedEvent | null]`; `error: [{ message: string; cause?: unknown }]`; `view-full-csv: [ViewFullCsvPayload]` (`{ fileName, text }`); `open-hardware-details: []`; `open-pipe-details: []`.

**Loading precedence.** When both `source` and prebuilt models are provided, prebuilt `swimlaneModel`/`reportModel` take precedence and `source` is not parsed.

**Theming.** `theme` prop drives `data-theme` on the `.pr-root` element; `tokens.css` supplies dark (default `:root`) and light (`.pr-root[data-theme='light']`) tokens. The library does not read VS Code `--vscode-*` variables — the host bridges them.

**Locale.** `locale` resolves through `resolveLocale`: `en*` → `en`, `zh*` → `zh-CN`, anything else → `zh-CN`.

**Capabilities.** `ReportCapability` union is `'roofline' | 'dependencies' | 'memoryDiagram' | 'hardwareDetails' | 'sourceTab' | 'cacheTab' | 'aicpu'`; empty/omitted shows only MVP panels.

## Dependencies

[ARCHITECTURE.md](../../docs/architecture/ARCHITECTURE.md), [MSTT_INTEGRATION.md](../../docs/architecture/MSTT_INTEGRATION.md), [USAGE.md](../../docs/usage/USAGE.md).

## Acceptance Criteria

*Architecture contracts — verified by integration tests and typecheck.*

## Changelog
- **2026-08-20** — Pinned the full `ProfilingReport` props/emits, loading precedence, theming, locale, and capabilities contract; linked the consumer usage guide.
- **2026-08-05** — Initial spec. Core behaviors established.
