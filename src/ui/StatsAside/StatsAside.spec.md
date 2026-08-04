# StatsAside

<!--
  metadata
  spec-id-prefix: PR-STATS-*
  phase: MVP
  owner: -
  last-updated: 2026-08-04
  source: src/ui/StatsAside/StatsAside.vue
  test: src/ui/StatsAside/StatsAside.spec.ts
-->

## Purpose

Right-side analytics panel showing report summary statistics and PIPE occupancy bars.

## Inputs / Outputs

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| report | ReportViewModel or null or undefined | yes | — | Report view model |
| locale | string | no | undefined | Locale code |

### Emits

None. Pure presentational.

## Behavior

- Renders report summary (op name, type, duration) from ReportViewModel.
- Renders PIPE occupancy bars with colors matching COLOR_TOKENS.
- Shows placeholder when report is null.

## Acceptance Criteria

1. **PR-STATS-001**: Renders summary stats when valid ReportViewModel is provided.
1. **PR-STATS-002**: Renders PIPE occupancy bars with correct colors.

## Edge Cases

- report is null or undefined — renders empty state.
- Empty pipe occupancy — no bars rendered.

## Dependencies

- [docs/specs/ui/COLOR_TOKENS.md] — pipe colors.
- [specs/core/view-models.spec.md] — ReportViewModel.

## Open Questions

- [Q6] — Product-final summary; currently thin (I-Q6a).
