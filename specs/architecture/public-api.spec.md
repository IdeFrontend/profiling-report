# Public API

<!--
  metadata
  spec-id-prefix: none (architectural contract)
  phase: MVP
  owner: -
  last-updated: 2026-08-04
  source: src/index.ts
-->

## Purpose

Define the library's public API surface — exports, types, and backward compatibility expectations.

## Inputs / Outputs

The library exports:

| Export | Type | Description |
|--------|------|-------------|
| `ProfilingReport` | Vue component | Main report viewer |
| `parseRep` | function | Parse `.rep` binary |
| `adaptRep` | function | Adapt parsed data to view models |
| `chromeTraceToSwimlane` | function | Convert CTEF to swimlane |
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
| (all types from domain/types) | type | Re-exported via `export type *` |

## Behavior

- Library is consumed as `@huawei/profiling-report`.
- Hosts import `ProfilingReport` component and format loaders from the barrel.
- Domain helpers available via deep imports for advanced hosts and tests.
- Vue is a peer dependency (^3.5.0).

## Acceptance Criteria

- Library builds as ESM and UMD.
- Type declarations generated correctly.
- Playground imports barrel without errors.

## Edge Cases

- Breaking changes to public API surface require version bump and migration notes.

## Dependencies

- [docs/specs/architecture/ARCHITECTURE.md] — original architecture spec.
- [docs/specs/architecture/MSTT_INTEGRATION.md] — host integration contract.

## Open Questions

- Deep import stability guarantee for domain helpers.
