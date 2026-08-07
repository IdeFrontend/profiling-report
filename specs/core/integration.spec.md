# Integration & E2E Tests

| spec-id-prefix |
|----------------|
| PR-UI-*, PR-E2E-* |

Outside-in tests verifying the full component tree and playground render correctly. These test composition — per-component units are tested in their own folders.

## Behavior

**Integration (Vitest + Vue Test Utils).** Mounts ProfilingReport with `data/out.rep` source and exercises the full component tree through prop updates and DOM queries. Verifies that loading produces visible chrome, interactions propagate state, the aside renders when data is available and hides for standalone CTEF, zoom-to-fit expands to full timeline, search filters events, and the overview brush updates the viewport.

**E2E (Playwright against playground).** Loads the playground with `data/out.rep` and verifies real browser rendering: timeline visible, hover shows tooltip, click selects event and shows detail strip, zoom-to-fit via toolbar, standalone JSON opens without aside, overview brush updates window and cursor.

## Acceptance Criteria

### Integration (PR-UI)

1. **PR-UI-001**: Mounts ProfilingReport with fixture source, shows timeline chrome.
1. **PR-UI-002**: Select emits detail payload with event name, startTime, and duration.
1. **PR-UI-003**: Aside renders summary stats and pipe occupancy when CSV data available.
1. **PR-UI-004**: Zoom-to-fit expands viewport to full timeline.
1. **PR-UI-005**: Search input filters events in swimlane.
1. **PR-UI-006**: Standalone CTEF renders timeline without aside panel.
1. **PR-UI-007**: Time overview brush emits window update events.
1. **PR-UI-008**: CSV-only report (compute/memory tables, no summary/pipe) auto-opens aside and shows toggle.

### E2E (PR-E2E)

1. **PR-E2E-001**: Playground loads `data/out.rep` and renders timeline.
1. **PR-E2E-002**: Hover over swimlane event shows tooltip.
1. **PR-E2E-003**: Click event selects it, detail strip shows name and times.
1. **PR-E2E-004**: Zoom-to-fit via toolbar renders full timeline span.
1. **PR-E2E-005**: Standalone JSON opens without CSV aside.
1. **PR-E2E-006**: Overview brush updates time window and cursor line.

## Dependencies

[UX_SPEC.md](../../docs/specs/ui/UX_SPEC.md) (scenarios S1–S3), [INTERACTIONS.md](../../docs/specs/ui/INTERACTIONS.md).

## Changelog
- **2026-08-05** — Initial spec. Core behaviors established.
