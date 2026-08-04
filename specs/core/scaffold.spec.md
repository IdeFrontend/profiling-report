# Scaffold Tests

<!--
  metadata
  spec-id-prefix: PR-SCAFFOLD-*
  phase: MVP
  owner: -
  last-updated: 2026-08-04
  source: tests/unit/scaffold.spec.ts, tests/e2e/playground.spec.ts
-->

## Purpose

Smoke tests that verify the project is wired correctly — library builds, tests run, playground loads.

## Acceptance Criteria

1. **PR-SCAFFOLD-001**: Unit test runner executes and passes a basic assertion.
1. **PR-SCAFFOLD-002**: Library imports resolve without errors.
1. **PR-SCAFFOLD-003**: ProfilingReport component mounts and renders its root element with timeline chrome.
1. **PR-SCAFFOLD-004**: Playground dev server starts and serves the demo page.

## Dependencies

- None; these are infrastructure smoke tests.

## Open Questions

- None.
