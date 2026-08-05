# ProfilingReport

<!--
  spec-id-prefix: PR-ROOT-*
  phase: MVP
  source: src/ui/ProfilingReport/ProfilingReport.vue
  test: src/ui/ProfilingReport/ProfilingReport.spec.ts
-->

Root component — parses source, manages state, composes all child components.

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| title | string | no | undefined | Panel/report title |
| source | ArrayBuffer or Uint8Array | no | undefined | Report binary data |
| swimlaneModel | SwimlaneModel | no | undefined | Pre-parsed swimlane (skip parsing) |
| reportModel | ReportViewModel | no | undefined | Pre-parsed report (skip parsing) |
| theme | `'light'` / `'dark'` | no | undefined | Theme variant |
| locale | string | no | undefined | Locale code |
| timeUnit | TimeDisplayUnit | no | `'ms'` | Time display unit |
| capabilities | ReportCapability[] | no | undefined | Feature flags |

## Emits

| Event | Payload | Description |
|-------|---------|-------------|
| ready | — | Report loaded and rendered |
| select | SelectedEvent or null | Event selected/deselected |
| error | { message: string; cause?: unknown } | Load/parse error |

**Behavior:** Parses source via loadReportSource. Uses pre-parsed models if provided. Manages view state, hover, selection, cursor, tooltip. Composes ReportToolbar, TimeOverviewBar, LaneGutter, SwimlaneCanvas, StatsAside, EventTooltip, DetailStrip inside ReportLayout.

- [Entry overview with sidebar](/docs/specs/ui/source/entry-overview.png)
- [Report stats](/docs/specs/ui/source/report-stats.png)

## Acceptance Criteria

1. **PR-ROOT-001**: Mounts with title prop and shows profiling-report shell.
1. **PR-ROOT-002**: Accepts pre-parsed swimlaneModel and reportModel.

## Edge Cases

- Empty source → empty state. Invalid source → emits error.

**Dependencies:** All child component specs, [mstt-integration](/specs/architecture/mstt-integration.spec.md).

**Open:** Q3 (OP selector), Q15 (standalone CTEF hides aside).
