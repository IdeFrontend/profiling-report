# ReportToolbar

<!--
  spec-id-prefix: PR-TOOLBAR-*
  phase: MVP
  source: src/ui/ReportToolbar/ReportToolbar.vue
  test: src/ui/ReportToolbar/ReportToolbar.spec.ts
-->

Top toolbar: search, zoom controls, time unit selector, aside toggle.

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| searchQuery | string | yes | — | Current search text |
| asideVisible | boolean | yes | — | Aside panel open |
| asideAvailable | boolean | yes | — | Aside panel available |
| zoomPercent | number | yes | — | Current zoom % |
| timeUnit | TimeDisplayUnit | yes | — | Time display unit |
| locale | string | no | undefined | Locale code |
| title | string | no | undefined | Report title |

## Emits

| Event | Payload | Description |
|-------|---------|-------------|
| update:searchQuery | string | Search text changed |
| update:asideVisible | boolean | Aside toggle clicked |
| update:timeUnit | TimeDisplayUnit | Time unit changed |
| zoom-to-fit | — | Zoom-to-fit clicked |
| zoom-in | — | Zoom in clicked |
| zoom-out | — | Zoom out clicked |
| update:zoomPercent | number | Zoom slider moved |

- [Entry overview](/docs/specs/ui/source/entry-overview.png)

## Acceptance Criteria

1. **PR-TOOLBAR-001**: Emits update:searchQuery when search text changes.
1. **PR-TOOLBAR-002**: Emits zoom-in on + button click.
1. **PR-TOOLBAR-003**: Emits zoom-out on - button click.
1. **PR-TOOLBAR-004**: Emits zoom-to-fit on button click.
1. **PR-TOOLBAR-005**: Emits update:timeUnit when unit changed.
1. **PR-TOOLBAR-006**: Emits update:asideVisible on aside toggle click.

## Edge Cases

- asideAvailable=false hides toggle. Search query initially empty.
