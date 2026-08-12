# TimelineView

| spec-id-prefix |
|----------------|
| PR-TIMELINE-*  |

Left-column stack: overview bar, time axis, and SwimlaneView body. Owns gutter resize chrome.

## Behavior

**Measure mode (M2).** The overview bar stays visible for window navigation (no measure span is drawn on it). The viewport time axis draws blue vertical bars at the measured range edges plus a double-sided Δt arrow. Swimlane fade/gray borders live in `SwimlaneCanvas`.

## Acceptance Criteria

1. **PR-TIMELINE-001** — Renders overview, time axis, and swimlane body regions.
2. **PR-TIMELINE-002** — When `view.measureMode` and `view.measureRange` are set, the time axis shows blue bars and a Δt arrow; the overview bar remains rendered.

## Changelog
- **2026-08-12** — Measure markers on time axis (blue bars + arrow); overview stays for navigation; PR-TIMELINE-002.
- **2026-08-10** — Extracted from ProfilingReport main slot.
