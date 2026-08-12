# TimelineView

| spec-id-prefix |
|----------------|
| PR-TIMELINE-*  |

Left-column stack: overview bar, time axis, and SwimlaneView body. Owns gutter resize chrome.

## Behavior

**Measure mode (M2).** When `view.measureMode` is true the overview bar (total-axis + window selection) is hidden — the time axis sits directly under the toolbar, and the measure selection is drawn on the swimlane (see `SwimlaneCanvas.spec.md`).

## Acceptance Criteria

1. **PR-TIMELINE-001** — Renders overview, time axis, and swimlane body regions.
2. **PR-TIMELINE-002** — Overview bar is not rendered when `view.measureMode` is true.

## Changelog
- **2026-08-12** — Hide overview bar in measure mode; PR-TIMELINE-002.
- **2026-08-10** — Extracted from ProfilingReport main slot.
