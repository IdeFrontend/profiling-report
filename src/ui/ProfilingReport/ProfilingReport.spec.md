# ProfilingReport

<!--
  metadata
  spec-id-prefix: PR-ROOT-*
  phase: MVP
  owner: -
  last-updated: 2026-08-04
  source: src/ui/ProfilingReport/ProfilingReport.vue
  test: src/ui/ProfilingReport/ProfilingReport.spec.ts
-->

## Purpose

Root component that orchestrates the full profiling report viewer — parses source, manages state, and composes all child components.

## Inputs / Outputs

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| title | string | no | undefined | Panel/report title |
| source | ArrayBuffer or Uint8Array | no | undefined | Report binary data |
| swimlaneModel | SwimlaneModel | no | undefined | Pre-parsed swimlane model |
| reportModel | ReportViewModel | no | undefined | Pre-parsed report model |
| theme | 'light' or 'dark' | no | undefined | Theme variant |
| locale | string | no | undefined | Locale code |
| timeUnit | TimeDisplayUnit | no | 'ms' | Time display unit |
| capabilities | ReportCapability[] | no | undefined | Feature flags |

### Emits

| Event | Payload | Description |
|-------|---------|-------------|
| ready | — | Report loaded and rendered |
| select | SelectedEvent or null | Event selected or deselected |
| error | { message: string; cause?: unknown } | Load/parse error |

## Behavior

- Parses source prop via loadReportSource when provided.
- Uses swimlaneModel/reportModel directly if provided (skip parsing for host-managed data).
- Manages view state, hover, selection, cursor, and tooltip.
- Composes ReportLayout > ReportToolbar + TimeOverviewBar + LaneGutter + SwimlaneCanvas + StatsAside + EventTooltip + DetailStrip.

## Design sketches

- [Entry overview with sidebar](/docs/specs/ui/source/entry-overview.png) — full layout with toolbar, gutter, swimlane, and aside
- [Report stats](/docs/specs/ui/source/report-stats.png) — summary statistics and PIPE occupancy in right panel

## Acceptance Criteria

1. **PR-ROOT-001**: Mounts with title prop and shows profiling-report shell.
1. **PR-ROOT-002**: Accepts pre-parsed swimlaneModel and reportModel props for externally managed data.

## Edge Cases

- Empty source — renders empty state without error.
- Invalid source — emits error event.

## Dependencies

- All child component specs.
- [specs/architecture/mstt-integration.spec.md] — host contract.

## Open Questions

- [Q3] — OP selector semantics.
- [Q15] — standalone CTEF hides aside.
