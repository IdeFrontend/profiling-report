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
| theme | string | no | `'dark'` | Theme variant |
| locale | string | no | `'zh-CN'` | Locale code |
| capabilities | ReportCapability | no | {} | Feature flags |

### Emits

| Event | Payload | Description |
|-------|---------|-------------|
| update:viewState | SwimlaneViewState | View state changes |

## Behavior

- Host passes report bytes as props (ArrayBuffer or Uint8Array).
- Component handles all parsing, adaptation, and rendering internally.
- Capability flags control feature visibility (roofline, memoryDiagram, dependencies, hardwareDetails, sourceTab, cacheTab, aicpu).
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
