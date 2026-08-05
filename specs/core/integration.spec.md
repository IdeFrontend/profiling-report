# Integration & E2E Tests

<!--
  spec-id-prefix: PR-UI-*, PR-E2E-*
  phase: MVP
  source: tests/component/ProfilingReport.feature.spec.ts, tests/e2e/feature.spec.ts
-->

Outside-in tests verifying the full component tree and playground render correctly. Counterpart to per-component and core unit tests.

## Acceptance Criteria

### Integration (PR-UI)

1. **PR-UI-001**: Mounts ProfilingReport with fixture source and shows timeline chrome.
1. **PR-UI-002**: Zoom, pan, and select interactions propagate state through component tree.
1. **PR-UI-003**: Aside renders summary stats and pipe occupancy when CSV data available.
1. **PR-UI-004**: Zoom-to-fit expands viewport to full timeline.
1. **PR-UI-005**: Search input filters events in swimlane.
1. **PR-UI-006**: Standalone CTEF renders timeline without aside panel.
1. **PR-UI-007**: Time overview brush emits window update events.

### E2E (PR-E2E)

1. **PR-E2E-001**: Playground loads `data/out.rep` and renders timeline.
1. **PR-E2E-002**: Hovering over swimlane event shows tooltip.
1. **PR-E2E-003**: Clicking event selects it and shows detail strip.
1. **PR-E2E-004**: Zoom-to-fit via toolbar renders full timeline span.
1. **PR-E2E-005**: Standalone JSON trace opens without CSV aside.
1. **PR-E2E-006**: Overview brush updates visible time window and cursor line.

**Dependencies:** [UX_SPEC.md](/docs/specs/ui/UX_SPEC.md) (S1–S3), [INTERACTIONS.md](/docs/specs/ui/INTERACTIONS.md).
