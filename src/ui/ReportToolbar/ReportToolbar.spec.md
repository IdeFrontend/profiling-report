# ReportToolbar

<!--
  metadata
  spec-id-prefix: PR-TOOLBAR-*
  phase: MVP
  owner: -
  last-updated: 2026-08-04
  source: src/ui/ReportToolbar/ReportToolbar.vue
  test: src/ui/ReportToolbar/ReportToolbar.spec.ts
-->

## Purpose

Top toolbar with search, zoom controls, time unit selector, and aside panel toggle.

## Inputs / Outputs

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| searchQuery | string | yes | — | Current search text |
| asideVisible | boolean | yes | — | Whether aside panel is open |
| asideAvailable | boolean | yes | — | Whether aside panel is available |
| zoomPercent | number | yes | — | Current zoom percentage |
| timeUnit | TimeDisplayUnit | yes | — | Time display unit |
| locale | string | no | undefined | Locale code |
| title | string | no | undefined | Report title |

### Emits

| Event | Payload | Description |
|-------|---------|-------------|
| update:searchQuery | string | Search text changed |
| update:asideVisible | boolean | Aside toggle clicked |
| update:timeUnit | TimeDisplayUnit | Time unit changed |
| zoom-to-fit | — | Zoom-to-fit clicked |
| zoom-in | — | Zoom in clicked |
| zoom-out | — | Zoom out clicked |
| update:zoomPercent | number | Zoom slider moved |

## Behavior

- Search input with v-model binding.
- Zoom +/- buttons and slider with percentage display.
- Time unit selector (ms/us/ns).
- Aside panel toggle button.

## Design sketches

- [Entry overview](/docs/specs/ui/source/entry-overview.png) — toolbar region with search, zoom controls, and tabs

## Acceptance Criteria

1. **PR-TOOLBAR-001**: Emits update:searchQuery when search text changes.
1. **PR-TOOLBAR-002**: Emits zoom-in when + button is clicked.
1. **PR-TOOLBAR-003**: Emits zoom-out when - button is clicked.
1. **PR-TOOLBAR-004**: Emits zoom-to-fit when zoom-to-fit button is clicked.
1. **PR-TOOLBAR-005**: Emits update:timeUnit when unit is changed.
1. **PR-TOOLBAR-006**: Emits update:asideVisible when aside toggle is clicked.

## Edge Cases

- Search query is empty string initially.
- asideAvailable=false hides toggle.

## Dependencies

- None.

## Open Questions

- None.
