# ReportLayout

<!--
  metadata
  spec-id-prefix: PR-LAYOUT-*
  phase: MVP
  owner: -
  last-updated: 2026-08-04
  source: src/ui/ReportLayout/ReportLayout.vue
  test: src/ui/ReportLayout/ReportLayout.spec.ts
-->

## Purpose

Main layout shell dividing the viewer into main content area and optional aside panel.

## Inputs / Outputs

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| showAside | boolean | yes | — | Whether aside panel is visible |

### Emits

None.

### Slots

| Slot | Props | Description |
|------|-------|-------------|
| main | — | Main content area |
| aside | — | Aside panel content |

## Behavior

- Renders main slot always.
- Conditionally renders aside slot when showAside is true.
- Applies CSS class `pr-layout--no-aside` when aside is hidden.

## Acceptance Criteria

1. **PR-LAYOUT-001**: Renders main slot content.
1. **PR-LAYOUT-002**: Shows aside slot when showAside is true.
1. **PR-LAYOUT-003**: Hides aside slot when showAside is false.

## Edge Cases

- Both slots empty — renders empty layout shell.

## Dependencies

- None.

## Open Questions

- None.
