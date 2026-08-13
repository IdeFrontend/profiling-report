# TimelineView

| spec-id-prefix |
|----------------|
| PR-TIMELINE-*  |

Left-column stack: overview bar, time axis, and SwimlaneView body. Gutter width CSS var is owned here; the resize handle lives on the SwimlaneView body (see `SwimlaneView.spec.md`).

## Behavior

**Measure mode (M2).** The overview bar stays visible for window navigation (no measure span is drawn on it). The viewport time axis draws blue vertical bars at the measured range edges plus a double-sided Δt arrow, and accepts the same drag-to-measure gesture as the swimlane. Swimlane fade/gray borders live in `SwimlaneCanvas`.

**Δt arrow geometry (v930).** Each arrowhead is an **open stroke chevron** (single path, `fill="none"`, sharp **miter** tip — not bevelled/flat). The visible tip sits **1px** inward from the adjacent vertical measure bar. The shaft overlaps deep into each chevron until it meets the arms (no gap between shaft and arrow lines). The Δt duration label sits centered on the arrow with a **4px gap** on each side between the label chrome and the horizontal shaft (shaft breaks around the label; they do not touch). Shaft and chevron strokes are **1.5px** wide in solid `rgba(49, 122, 247, 1)`.

## Acceptance Criteria

1. **PR-TIMELINE-001** — Renders overview, time axis, and swimlane body regions.
2. **PR-TIMELINE-002** — When `view.measureMode` and `view.measureRange` are set, the time axis shows blue bars and a Δt arrow; the overview bar remains rendered.
3. **PR-TIMELINE-003** — In measure mode, drag on the time axis emits `update:measure-range`.
4. **PR-TIMELINE-004** — Measure arrow: sharp miter stroke chevrons, **1px** tip–bar gap, shaft overlaps into heads, **4px** shaft–label gaps; 1.5px stroke; `rgba(49, 122, 247, 1)`.

## Changelog
- **2026-08-13** — 4px gaps between Δt label and horizontal shaft segments.
- **2026-08-13** — Tip gap back to 1px.
- **2026-08-13** — Tip gap 3px; sharp miter tips; shaft overlaps to arm convergence.
- **2026-08-13** — Shaft overlaps chevrons; tip gap preserved without miter overshoot.
- **2026-08-13** — Δt arrow stroke 1.5px, color `rgba(49, 122, 247, 1)`.
- **2026-08-12** — Spec open stroke chevrons + 1px bar gap for Δt arrow; PR-TIMELINE-004.
- **2026-08-12** — Measure drag on time axis; PR-TIMELINE-003.
- **2026-08-12** — Measure markers on time axis (blue bars + arrow); overview stays for navigation; PR-TIMELINE-002.
- **2026-08-10** — Extracted from ProfilingReport main slot.
