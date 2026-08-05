# Scaffold Tests

| spec-id-prefix |
|----------------|
| PR-SCAFFOLD-*  |

Infrastructure smoke tests: project builds, test runner works, library imports resolve, playground serves.

## Acceptance Criteria

1. **PR-SCAFFOLD-001**: Exports library name (`LIBRARY_NAME === 'profiling-report'`).
1. **PR-SCAFFOLD-002**: parseRep reads golden fixture magic bytes (`'cann-rep'`).
1. **PR-SCAFFOLD-003**: ProfilingReport mounts and renders root element with timeline chrome.
1. **PR-SCAFFOLD-004**: Playground dev server starts and serves the demo page.

## Changelog
- **2026-08-05** — Initial spec. Core behaviors established.
