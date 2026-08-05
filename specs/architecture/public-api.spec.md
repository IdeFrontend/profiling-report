# Public API

<!--
  spec-id-prefix: none (architectural contract)
  phase: MVP
  source: src/index.ts
-->

Library public API surface — exports, types, and backward compatibility. Consumed as `@huawei/profiling-report`. Vue is peer dependency (^3.5.0).

| Export | Type | Description |
|--------|------|-------------|
| `ProfilingReport` | Vue component | Main report viewer |
| `parseRep` | function | Parse `.rep` binary |
| `adaptRep` | function | Adapt parsed data → view models |
| `chromeTraceToSwimlane` | function | CTEF → SwimlaneModel |
| `loadReportSource` | function | Auto-detect and load report |
| `adaptChromeTrace` | function | Adapt CTEF JSON |
| `formatTime` | function | Time formatting (multi-purpose) |
| `formatAxisTime` | function | Axis tick formatting |
| `formatCursorTime` | function | Cursor/label formatting |
| `t` | function | i18n translation |
| `resolveLocale` | function | Locale resolution |
| `computeThreadUtilization` | function | Utilization math |
| `coveredLength` | function | Covered duration |
| `withDerivedUtilizations` | function | Attach utilization to threads |
| `colorForThread` | function | Lane colors |
| `colorVarForLaneName` | function | CSS variable for lane |
| `laneColorKey` | function | Color key extraction |
| `createViewState` | function | View state factory |
| `zoomToFitWindow` | function | Zoom-to-fit |
| `zoomAt` | function | Anchor zoom |
| `panBy` | function | Pan viewport |
| `applyWindow` | function | Apply window to state |
| `CanvasSwimlaneRenderer` | class | Canvas renderer |
| `LANE_GROUP_HEADER_HEIGHT` | const | Layout constant |
| `LANE_HEIGHT` | const | Layout constant |
| `LIBRARY_NAME` | const | `'profiling-report'` |
| (all domain types) | type | Re-exported via `export type *` |

Hosts import `ProfilingReport` and format loaders from barrel. Domain helpers via deep imports. Library builds as ESM + UMD.

**Dependencies:** [ARCHITECTURE.md](/docs/specs/architecture/ARCHITECTURE.md), [MSTT_INTEGRATION.md](/docs/specs/architecture/MSTT_INTEGRATION.md).
