# ReportToolbar

<!--
  spec-id-prefix: PR-TOOLBAR-*
  phase: MVP
  source: src/ui/ReportToolbar/ReportToolbar.vue
  test: src/ui/ReportToolbar/ReportToolbar.spec.ts
-->

Top toolbar with search, zoom controls, time unit selector, and aside panel toggle.

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| searchQuery | string | yes | — | Current search text (v-model) |
| asideVisible | boolean | yes | — | Whether aside panel is open |
| asideAvailable | boolean | yes | — | Whether aside panel can be shown (hidden for standalone CTEF) |
| zoomPercent | number | yes | — | Current zoom percentage display |
| timeUnit | TimeDisplayUnit | yes | — | Current time unit |
| locale | string | no | undefined | UI label locale |
| title | string | no | undefined | Report title shown in the toolbar |

## Emits

| Event | Payload | Description |
|-------|---------|-------------|
| update:searchQuery | string | Search text changed |
| update:asideVisible | boolean | Toggle aside panel visibility |
| update:timeUnit | TimeDisplayUnit | Time unit switched (ms/µs/ns) |
| zoom-to-fit | — | Fit entire timeline to viewport |
| zoom-in | — | Zoom in around center |
| zoom-out | — | Zoom out around center |
| update:zoomPercent | number | Zoom slider dragged |

## Behavior

**UI layout.** The toolbar contains: a tabs row (Timeline selected by default, others P2), a search input, zoom buttons (+, -, slider, zoom-to-fit), a time unit dropdown (ms/µs/ns), and an aside toggle button.

**Zoom controls.** Toolbar buttons signal intent — the parent ProfilingReport computes the actual zoom around the viewport center. The percentage slider shows the ratio of viewport span to total timeline span. Zoom-to-fit resets to full timeline.

**Aside toggle.** The toggle button is visible only when `asideAvailable` is true (hidden for standalone CTEF per Q15). Click toggles the panel with `update:asideVisible`.

**Time unit.** Changing the time unit reformats all displayed times (axis ticks, tooltip, detail strip, playhead) across the entire UI. The dropdown emits `update:timeUnit`, the parent propagates to all children.

## Acceptance Criteria

1. **PR-TOOLBAR-001**: Emits update:searchQuery when search text changes.
1. **PR-TOOLBAR-002**: Emits zoom-in on + button click.
1. **PR-TOOLBAR-003**: Emits zoom-out on - button click.
1. **PR-TOOLBAR-004**: Emits zoom-to-fit on button click.
1. **PR-TOOLBAR-005**: Emits update:timeUnit when unit dropdown changed.
1. **PR-TOOLBAR-006**: Emits update:asideVisible on aside toggle click.

## Edge Cases

- asideAvailable=false → toggle button hidden.
- Search query initially empty, user types to filter.

## Design sketches

- [Entry overview](/docs/specs/ui/source/entry-overview.png)
