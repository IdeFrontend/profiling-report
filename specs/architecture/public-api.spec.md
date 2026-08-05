# Public API

<!--
  spec-id-prefix: none (architectural contract)
  phase: MVP
  source: src/index.ts
-->

Library public API surface consumed as `@huawei/profiling-report`. Vue is peer dependency (^3.5.0). Library builds as ESM + UMD.

## Exports

| Export | Type | Description |
|--------|------|-------------|
| `ProfilingReport` | Vue component | Main report viewer |
| `parseRep` | function | Parse `.rep` binary |
| `adaptRep` | function | Adapt parsed → view models |
| `chromeTraceToSwimlane` | function | CTEF → SwimlaneModel |
| `loadReportSource` | function | Auto-detect and load report |
| `adaptChromeTrace` | function | Adapt standalone CTEF JSON |
| `formatTime` | function | Time formatting (general) |
| `formatAxisTime` | function | Axis tick formatting |
| `formatCursorTime` | function | Cursor/label `MM:SS.mmm` |
| `t` | function | i18n translation |
| `resolveLocale` | function | Locale resolution |
| `computeThreadUtilization` | function | Thread coverage ratio |
| `coveredLength` | function | Merged interval duration |
| `withDerivedUtilizations` | function | Attach utilization to threads |
| `colorForThread` | function | Lane color assignment |
| `colorVarForLaneName` | function | CSS variable for lane |
| `laneColorKey` | function | Color key extraction |
| `createViewState` | function | View state initializer |
| `zoomToFitWindow` | function | Zoom to full timeline |
| `zoomAt` | function | Anchor zoom |
| `panBy` | function | Pan viewport |
| `applyWindow` | function | Apply window to state |
| `CanvasSwimlaneRenderer` | class | Imperative canvas renderer |
| `LANE_GROUP_HEADER_HEIGHT` | const | 28px |
| `LANE_HEIGHT` | const | 22px |
| `LIBRARY_NAME` | const | `'profiling-report'` |
| (all domain types) | type | Re-exported via `export type *` |

**Host usage.** Hosts import `ProfilingReport` and format loaders from the barrel. Domain helpers (colors, utilization, view state) are available via deep imports for advanced hosts that need to pre-process data before passing it as props.

**Dependencies:** [ARCHITECTURE.md](/docs/specs/architecture/ARCHITECTURE.md), [MSTT_INTEGRATION.md](/docs/specs/architecture/MSTT_INTEGRATION.md).
