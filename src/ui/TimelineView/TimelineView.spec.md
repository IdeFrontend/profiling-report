# TimelineView

| spec-id-prefix |
|----------------|
| PR-TIMELINE-*  |

Left-column stack: overview bar, time axis, and SwimlaneView body. Owns gutter resize chrome.

## Behavior

**Measure mode (M2).** The overview bar stays visible for window navigation (no measure span is drawn on it). The viewport time axis draws blue vertical bars at the measured range edges plus a double-sided Δt arrow, and accepts the same drag-to-measure gesture as the swimlane. Swimlane fade/gray borders live in `SwimlaneCanvas`.

**Δt arrow geometry (v930).** Each arrowhead is an **open stroke chevron** (two diagonal lines only — `fill="none"`, no solid triangle). The tip of each chevron sits **1px inward** from the adjacent vertical measure bar (not flush). The shaft meets the open base of each chevron (no gap in the middle of the arrow).

## Acceptance Criteria

1. **PR-TIMELINE-001** — Renders overview, time axis, and swimlane body regions.
2. **PR-TIMELINE-002** — When `view.measureMode` and `view.measureRange` are set, the time axis shows blue bars and a Δt arrow; the overview bar remains rendered.
3. **PR-TIMELINE-003** — In measure mode, drag on the time axis emits `update:measure-range`.
4. **PR-TIMELINE-004** — Measure arrowheads are stroke chevrons (`fill="none"`) inset 1px from the left/right axis bars.

## Changelog
- **2026-08-12** — Spec open stroke chevrons + 1px bar gap for Δt arrow; PR-TIMELINE-004.
- **2026-08-12** — Measure drag on time axis; PR-TIMELINE-003.
- **2026-08-12** — Measure markers on time axis (blue bars + arrow); overview stays for navigation; PR-TIMELINE-002.
- **2026-08-10** — Extracted from ProfilingReport main slot.
