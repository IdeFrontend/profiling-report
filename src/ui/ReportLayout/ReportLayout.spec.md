# ReportLayout

<!--
  spec-id-prefix: PR-LAYOUT-*
  phase: MVP
  source: src/ui/ReportLayout/ReportLayout.vue
  test: src/ui/ReportLayout/ReportLayout.spec.ts
-->

Main layout shell: main content area + optional aside panel.

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| showAside | boolean | yes | — | Show aside panel |

## Slots

| Slot | Description |
|------|-------------|
| main | Main content area |
| aside | Aside panel content |

**Behavior:** Renders main slot always. Renders aside slot when showAside is true. Adds CSS class `pr-layout--no-aside` when hidden.

- [Entry overview](/docs/specs/ui/source/entry-overview.png) — two-column layout

## Acceptance Criteria

1. **PR-LAYOUT-001**: Renders main slot content.
1. **PR-LAYOUT-002**: Shows aside slot when showAside is true.
1. **PR-LAYOUT-003**: Hides aside slot when showAside is false.
