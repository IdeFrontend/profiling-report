# MSTT Integration

<!--
  spec-id-prefix: none (architectural contract)
  phase: MVP
  source: docs/specs/architecture/MSTT_INTEGRATION.md
-->

Contract between profiling-report library and primary host (MSTT). Library has no runtime deps on PyPTO, Sudu, or MsInsight.

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| source | ArrayBuffer or Uint8Array | no | undefined | Report data |
| title | string | no | undefined | Panel title |
| theme | `'light'` / `'dark'` | no | undefined | Theme variant |
| locale | string | no | undefined | Locale code |
| timeUnit | TimeDisplayUnit | no | `'ms'` | Time display unit |
| capabilities | ReportCapability[] | no | undefined | Feature flags |
| swimlaneModel | SwimlaneModel | no | undefined | Pre-parsed swimlane |
| reportModel | ReportViewModel | no | undefined | Pre-parsed report |

`ReportCapability`: `'roofline' | 'dependencies' | 'memoryDiagram' | 'hardwareDetails' | 'sourceTab' | 'cacheTab' | 'aicpu'`.

## Emits

| Event | Payload | Description |
|-------|---------|-------------|
| ready | — | Report loaded and rendered |
| select | SelectedEvent or null | Event selected/deselected |
| error | { message: string; cause?: unknown } | Load/parse error |

**Behavior:** Host passes report bytes as props. Component handles all parsing, adaptation, rendering internally. Empty source → empty state. Capability flags toggle feature panels. Multiple instances independent.

**Dependencies:** [public-api](./public-api.spec.md).

**Open:** Q16–Q19 — packaging and integration specifics (see PACKAGING_SUGGESTIONS.md).
