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
| source | ArrayBuffer or Uint8Array | no | undefined | Report binary (`.rep` or CTEF) |
| title | string | no | undefined | Panel title |
| theme | `'light'` / `'dark'` | no | undefined | Theme |
| locale | string | no | undefined | UI locale (`zh-CN` default) |
| timeUnit | TimeDisplayUnit | no | `'ms'` | Display unit |
| capabilities | ReportCapability[] | no | undefined | Feature flags |
| swimlaneModel | SwimlaneModel | no | undefined | Host-managed swimlane |
| reportModel | ReportViewModel | no | undefined | Host-managed report |

`ReportCapability`: `'roofline' | 'dependencies' | 'memoryDiagram' | 'hardwareDetails' | 'sourceTab' | 'cacheTab' | 'aicpu'`.

## Emits

| Event | Payload | Description |
|-------|---------|-------------|
| ready | — | Report loaded and rendered |
| select | SelectedEvent or null | User selected or deselected an event |
| error | { message, cause? } | Load/parse failure |

## Integration pattern

**Two loading paths:** (1) Host passes `source` — library auto-detects format, parses, adapts, renders. (2) Host passes `swimlaneModel` + `reportModel` directly — library skips parsing and renders immediately. Path (2) is for hosts that manage their own data pipeline.

**Feature flags.** `capabilities` controls which sub-panels are rendered. By default (undefined or empty array), only MVP features are shown. Enabling `'roofline'` etc. in Phase 2 will unlock additional aside panel modes. The capabilities array is joined into a data attribute for CSS/test hooking.

**Independence.** Multiple ProfilingReport instances on the same page operate independently — each owns its own SwimlaneViewState. The library does not read from globals, shared stores, or URL parameters.

## Acceptance Criteria

- Component mounts and renders with only `source` prop.
- Component mounts and renders with only `swimlaneModel` + `reportModel` props.
- Empty source renders empty state without error.
- Capability flags toggle feature panel visibility.

**Dependencies:** [public-api](./public-api.spec.md).

**Open:** Q16–Q19 — packaging and integration specifics (see PACKAGING_SUGGESTIONS.md).
