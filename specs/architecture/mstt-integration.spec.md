# MSTT Integration

Integration contract between profiling-report library and primary host (MSTT). Library has no runtime deps on PyPTO, Sudu, or MsInsight.

## Behavior

**Two loading paths.** (1) Host passes `source` prop — library auto-detects format, parses, adapts, renders. (2) Host passes `swimlaneModel` + `reportModel` directly — library skips parsing and renders immediately. Path (2) is for hosts that manage their own data pipeline and want to bypass the library's internal parsing.

**Feature flags.** `capabilities` (`ReportCapability[]`) controls which sub-panels can be rendered. By default (undefined/empty), only MVP features are shown. Adding capability strings (`'roofline'`, `'dependencies'`, `'memoryDiagram'`, `'hardwareDetails'`, `'sourceTab'`, `'cacheTab'`, `'aicpu'`) unlocks corresponding Phase 2 panel modes. The array is joined into a data attribute for CSS and test hooking.

**Independence.** Multiple ProfilingReport instances on the same page operate independently — each owns its own `SwimlaneViewState`. The library does not read from globals, shared stores, or URL parameters.

**Emits.** `ready` fires after source is parsed and models are loaded. `select` fires with `SelectedEvent` or null when the user selects/deselects an event. `error` fires with `{ message, cause? }` on load/parse failure.

## Edge Cases

- Empty source → empty shell without error.
- Both `source` and pre-parsed models provided → `source` takes precedence.
- Multi-instance on one page → fully independent state.

## Dependencies

[public-api](./public-api.spec.md).

## Acceptance Criteria

*Architecture contracts — verified by integration tests.*

## Open

Q16–Q19 — packaging and integration specifics (see PACKAGING_SUGGESTIONS.md).

## Changelog
- **2026-08-05** — Initial spec. Core behaviors established.
