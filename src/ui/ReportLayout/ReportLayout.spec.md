# ReportLayout

<!--
  spec-id-prefix: PR-LAYOUT-*
  phase: MVP
  source: src/ui/ReportLayout/ReportLayout.vue
  test: src/ui/ReportLayout/ReportLayout.spec.ts
-->

Main layout shell dividing the viewer into two columns: the main content area (gutter + time axis + overview + swimlane) and an optional right aside panel (stats + pipe occupancy).

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| showAside | boolean | yes | — | Whether to render the aside column |

## Slots

| Slot | Description |
|------|-------------|
| main | Main content area (gutter, time axis, swimlane) |
| aside | Right panel content (stats, pipe occupancy) |

## Behavior

**Layout structure.** Uses CSS flexbox with two columns. The main column takes the remaining space. The aside column has a fixed width when visible and collapses to zero when hidden. When `showAside` is false, the `pr-layout--no-aside` CSS class is applied, which sets the aside column to `display: none`.

**Slot rendering.** The `main` slot is always rendered regardless of state. The `aside` slot is conditionally rendered via `v-if` — when the slot is not rendered, any reactive state inside it (watchers, timers) is destroyed and recreated on remount. This avoids stale data in hidden panels.

## Acceptance Criteria

1. **PR-LAYOUT-001**: Renders main slot content in all states.
1. **PR-LAYOUT-002**: Shows aside slot content when showAside is true.
1. **PR-LAYOUT-003**: Hides aside slot content when showAside is false.

## Design sketches

- [Entry overview](/docs/specs/ui/source/entry-overview.png)
