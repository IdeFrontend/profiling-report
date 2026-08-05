# TimeOverviewBar

<!--
  spec-id-prefix: PR-OVERVIEW-*
  phase: MVP
  source: src/ui/TimeOverviewBar/TimeOverviewBar.vue
  test: src/ui/TimeOverviewBar/TimeOverviewBar.spec.ts
-->

Full timeline preview bar with draggable/resizable window indicator for the visible viewport.

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| minTime | number | yes | — | Timeline start |
| maxTime | number | yes | — | Timeline end |
| startTime | number | yes | — | Visible window start |
| endTime | number | yes | — | Visible window end |
| timeUnit | TimeDisplayUnit | yes | — | Time display unit |

## Emits

| Event | Payload | Description |
|-------|---------|-------------|
| update:window | { startTime: number; endTime: number } | Window dragged/resized |

**Behavior:** Renders full timeline as background bar with draggable window indicator (move, resize edges). Emits update:window on drag end.

- [Statistical analysis (overview charts)](/docs/specs/ui/source/statistical-analysis.png)

## Acceptance Criteria

1. **PR-OVERVIEW-001**: Renders timeline bar with visible window indicator.
1. **PR-OVERVIEW-002**: Window indicator covers correct proportion of total span.

## Edge Cases

- minTime == maxTime → no bar. Window covers full timeline → indicator fills bar.
