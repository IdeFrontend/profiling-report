# MSTT Integration

<!--
  metadata
  spec-id-prefix: none (architectural contract)
  phase: MVP
  owner: -
  last-updated: 2026-08-04
  source: docs/specs/architecture/MSTT_INTEGRATION.md
-->

## Purpose

Define the contract between the profiling-report library and its primary host, MSTT.

## Inputs / Outputs

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| source | ArrayBuffer or Uint8Array | no | undefined | Report data |
| title | string | no | undefined | Panel title |
| theme | 'light' or 'dark' | no | undefined | Theme variant |
| locale | string | no | undefined | Locale code |
| timeUnit | TimeDisplayUnit | no | 'ms' | Time display unit |
| capabilities | ReportCapability[] | no | undefined | Feature flag array |
| swimlaneModel | SwimlaneModel | no | undefined | Pre-parsed swimlane data |
| reportModel | ReportViewModel | no | undefined | Pre-parsed report data |

Where `ReportCapability` is one of: `'roofline'`, `'dependencies'`, `'memoryDiagram'`, `'hardwareDetails'`, `'sourceTab'`, `'cacheTab'`, `'aicpu'`.

### Emits

| Event | Payload | Description |
|-------|---------|-------------|
| ready | — | Report loaded and rendered |
| select | SelectedEvent or null | Event selected or deselected |
| error | { message: string; cause?: unknown } | Load or parse error |

## Behavior

- Host passes report bytes as props (ArrayBuffer or Uint8Array).
- Component handles all parsing, adaptation, and rendering internally.
- capabilities is an array of strings (`ReportCapability[]`) controlling feature visibility.
- Library does not depend on PyPTO, Sudu, or MsInsight at runtime.

## Acceptance Criteria

- Component mounts and renders with only source prop.
- Empty source shows empty state.
- Capability flags toggle feature panels.

## Edge Cases

- Multiple instances in same page — independent state.

## Dependencies

- [specs/architecture/public-api.spec.md] — library exports.
- [docs/specs/architecture/ARCHITECTURE.md] — packaging design.

## Open Questions

- [Q16-Q19] — packaging and integration specifics (see PACKAGING_SUGGESTIONS.md).
