# ReportLayout

<!--
  spec-id-prefix: PR-LAYOUT-*
  phase: MVP
  source: src/ui/ReportLayout/ReportLayout.vue
  test: src/ui/ReportLayout/ReportLayout.spec.ts
-->

Main layout shell: two-column flexbox with main content area and optional right aside panel.

## Inputs

**showAside** controls whether the right column is rendered. Content for both columns is passed via named slots: **main** (gutter, time axis, swimlane) and **aside** (stats, pipe occupancy).

## Outputs

Purely structural — no emitted events.

## Behavior

The main column always renders. The aside column has a fixed width when visible and collapses when `showAside` is false (the column element is removed from DOM, not just hidden — any reactive state in the aside slot is destroyed and recreated on remount, preventing stale data).

The parent ProfilingReport controls `showAside` based on whether there is data to display: it auto-hides for standalone CTEF traces (no CSV embeds, so no summary or pipe occupancy) and shows when a `.rep` source provides report data.

## Acceptance Criteria

1. **PR-LAYOUT-001** — Renders main slot.
2. **PR-LAYOUT-002** — Shows aside panel.
3. **PR-LAYOUT-003** — Hides aside panel.

## Edge Cases

- Both slots empty → empty shell renders without error.

## Design sketches

- [Entry overview](../../../docs/specs/ui/source/entry-overview.png) — two-column layout
