# Integration & E2E Tests

<!--
  metadata
  spec-id-prefix: PR-UI-*, PR-E2E-*
  phase: MVP
  owner: -
  last-updated: 2026-08-04
  source: tests/component/ProfilingReport.feature.spec.ts, tests/e2e/feature.spec.ts
-->

## Purpose

Integration and end-to-end tests that verify the full component tree and playground render correctly. These are the "outside-in" counterpart to individual component and core unit tests.

## Acceptance Criteria

### Integration (PR-UI)

1. **PR-UI-001**: Mounts ProfilingReport with fixture source and shows timeline chrome.
1. **PR-UI-002**: Zoom, pan, and select interactions propagate state through the component tree.
1. **PR-UI-003**: Report aside renders summary stats and pipe occupancy when CSV data is available.
1. **PR-UI-004**: Zoom-to-fit button expands the viewport to cover the full timeline.
1. **PR-UI-005**: Search input filters events in the swimlane.
1. **PR-UI-006**: Standalone CTEF renders timeline without aside panel.
1. **PR-UI-007**: Time overview brush emits window update events.

### E2E (PR-E2E)

1. **PR-E2E-001**: Playground loads golden fixture `data/out.rep` and renders timeline.
1. **PR-E2E-002**: Hovering over a swimlane event shows tooltip.
1. **PR-E2E-003**: Clicking an event selects it and shows detail strip.
1. **PR-E2E-004**: Zoom-to-fit via toolbar renders full timeline span.
1. **PR-E2E-005**: Standalone JSON trace opens without CSV aside.
1. **PR-E2E-006**: Overview brush updates visible time window and cursor line.

## Dependencies

- [docs/specs/ui/UX_SPEC.md] — usage scenarios S1-S3.
- [docs/specs/ui/INTERACTIONS.md] — gesture specifications.

## Open Questions

- None; these tests verify behavior defined in existing UX specs.
