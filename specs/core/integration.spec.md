# Integration & E2E Tests

<!--
  spec-id-prefix: PR-UI-*, PR-E2E-*
  phase: MVP
  source: tests/component/ProfilingReport.feature.spec.ts, tests/e2e/feature.spec.ts
-->

Outside-in tests verifying the full component tree renders and behaves correctly. Counterpart to per-component unit tests — these test composition, not individual units.

## Acceptance Criteria

### Integration (PR-UI) — Vitest + Vue Test Utils

1. **PR-UI-001**: Mounts ProfilingReport with `data/out.rep` source, shows timeline chrome.
1. **PR-UI-002**: Zoom, pan, and select interactions propagate state through component tree correctly.
1. **PR-UI-003**: Aside renders summary stats and pipe occupancy when CSV data available in `.rep`.
1. **PR-UI-004**: Zoom-to-fit expands viewport to full timeline span.
1. **PR-UI-005**: Search input filters events in swimlane.
1. **PR-UI-006**: Standalone CTEF (no CSV pack) renders timeline without aside panel.
1. **PR-UI-007**: Time overview brush emits window update events that change the viewport.

### E2E (PR-E2E) — Playwright against playground

1. **PR-E2E-001**: Playground loads `data/out.rep` and renders timeline visible on screen.
1. **PR-E2E-002**: Hover over swimlane event shows tooltip with event name and times.
1. **PR-E2E-003**: Click event selects it, detail strip shows event name and times.
1. **PR-E2E-004**: Zoom-to-fit via toolbar button renders full timeline span.
1. **PR-E2E-005**: Standalone JSON trace opens without CSV aside panel.
1. **PR-E2E-006**: Overview brush updates visible time window and cursor line.

**Dependencies:** [UX_SPEC.md](/docs/specs/ui/UX_SPEC.md) (S1–S3), [INTERACTIONS.md](/docs/specs/ui/INTERACTIONS.md).
