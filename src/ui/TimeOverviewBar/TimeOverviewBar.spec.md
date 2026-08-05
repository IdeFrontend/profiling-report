# TimeOverviewBar

<!--
  metadata
  spec-id-prefix: PR-OVERVIEW-*
  phase: MVP
  owner: -
  last-updated: 2026-08-04
  source: src/ui/TimeOverviewBar/TimeOverviewBar.vue
  test: src/ui/TimeOverviewBar/TimeOverviewBar.spec.ts
-->

## Purpose

Time overview bar showing the full timeline span with a draggable/resizable window indicator for the visible viewport.

## Inputs / Outputs

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| minTime | number | yes | — | Timeline start (us) |
| maxTime | number | yes | — | Timeline end (us) |
| startTime | number | yes | — | Visible window start (us) |
| endTime | number | yes | — | Visible window end (us) |
| timeUnit | TimeDisplayUnit | yes | — | Time display unit |

### Emits

| Event | Payload | Description |
|-------|---------|-------------|
| update:window | { startTime: number; endTime: number } | Window dragged or resized |

## Behavior

- Renders full timeline span as background bar.
- Shows draggable window indicator (move, resize left/right edges).
- Emits update:window on drag end.

## Design sketches

- [Statistical analysis (overview charts)](/docs/specs/ui/source/statistical-analysis.png) — time-aligned overview series and time axis

## Acceptance Criteria

1. **PR-OVERVIEW-001**: Renders timeline bar with visible window indicator.
1. **PR-OVERVIEW-002**: Emits update:window when window indicator is dragged.

## Edge Cases

- minTime equals maxTime — single point, no bar rendered.
- Window covers full timeline — indicator fills entire bar.

## Dependencies

- None.

## Open Questions

- None.
