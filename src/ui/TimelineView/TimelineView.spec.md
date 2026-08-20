# TimelineView

| spec-id-prefix |
|----------------|
| PR-TIMELINE-*  |

Left-column stack: overview bar, time axis, and SwimlaneView body. Gutter width CSS var is owned here; the resize handle lives on the SwimlaneView body (see `SwimlaneView.spec.md`). Overview/axis top chrome is **not** resizable.

## Behavior

**Top chrome gutter.** Overview and viewport-axis gutter spacers form one continuous block: **no** horizontal border between those two spacer cells. (Timeline-column borders between overview track and viewport axis may remain.)

**Measure mode (M2).** The overview bar stays visible for window navigation (no measure span is drawn on it). The viewport time axis draws blue vertical bars at the measured range edges plus a double-sided Δt arrow, and accepts the same drag-to-measure gesture as the swimlane. Bars/arrow geometry **clamp to the current view window**; a range fully outside the view hides the axis overlay (Δt label still uses the full measured duration when partially visible). Swimlane fade/gray borders live in `SwimlaneCanvas`.

**Δt arrow geometry (v930).** Each arrowhead is an **open stroke chevron** (single path, `fill="none"`, sharp **miter** tip — not bevelled/flat). The visible tip sits **1px** inward from the adjacent vertical measure bar. The shaft overlaps deep into each chevron until it meets the arms (no gap between shaft and arrow lines). The Δt duration label sits centered on the arrow with a **4px gap** on each side between the label chrome and the horizontal shaft (shaft breaks around the label; they do not touch). Shaft and chevron strokes are **1.5px** wide in solid `rgba(49, 122, 247, 1)`.

**Narrow selection.** When the measured span’s pixel width is smaller than pads + heads + shaft–label gaps + label width, park the duration pill **outside** the bars (prefer **4px to the right** of the right bar; if that would clip, **4px to the left** of the left bar) while still drawing the two-sided arrow between the bars. When the span is so narrow that the arrowheads would overlap (`<` pads + both heads ≈ **20px**), hide the heads and keep a continuous horizontal shaft between the vertical bars; the outside label stays.

**Cursor vs measure chrome.** When a measure overlay is visible and the **cursor timestamp pill** overlaps the selected range (playhead inside, or playhead just outside with the pill crossing a border) or covers an outside Δt label, the pill lifts **above** the viewport axis (`labelAbove`) with a short animated transition (see `CursorTimestamp`). Otherwise it stays in-track.

**Edge resize.** Axis blue bars are 9px hit pads with a 1px stem (`col-resize`); hover/active thickens the stem to 2px. Dragging left/right moves that edge only (other edge fixed), clamped to the view window with a ~1px min span. Empty-axis drag still creates a new measure range.

## Acceptance Criteria

1. **PR-TIMELINE-001** — Renders overview, time axis, and swimlane body regions.
2. **PR-TIMELINE-002** — When `view.measureMode` and `view.measureRange` are set, the time axis shows blue bars and a Δt arrow; the overview bar remains rendered.
3. **PR-TIMELINE-003** — In measure mode, drag on the time axis emits `update:measure-range`.
4. **PR-TIMELINE-004** — Measure arrow: sharp miter stroke chevrons, **1px** tip–bar gap, shaft overlaps into heads, **4px** shaft–label gaps; 1.5px stroke; `rgba(49, 122, 247, 1)`.
5. **PR-TIMELINE-005** — When the selection is too narrow for an in-between label but wide enough for both heads, the label sits outside the range and the two-sided arrow still spans the bars.
6. **PR-TIMELINE-006** — Measure axis bars clamp to the current view window when the range extends outside.
7. **PR-TIMELINE-007** — Measure axis overlay hides when the range is fully outside the current view.
8. **PR-TIMELINE-008** — When the selection is so narrow that arrowheads would overlap, hide heads and keep the horizontal shaft between bars with the label outside.
9. **PR-TIMELINE-009** — With a visible measure range, cursor pill overlapping the selection (inside, or outside with label crossing a border) uses above-axis placement; cursor clear of the range stays in-track.
10. **PR-TIMELINE-010** — Dragging an axis measure bar resizes that edge (other edge fixed); bars use a 9px hit pad, `col-resize`, and 2px stem on hover.

## Changelog
- **2026-08-20** — Draggable axis measure bars; PR-TIMELINE-010.
- **2026-08-20** — Cursor timestamp lifts above axis on measure chrome overlap; PR-TIMELINE-009.
- **2026-08-20** — Outside-label keeps arrow; shaft-only when heads overlap; PR-TIMELINE-005/008.
- **2026-08-20** — Clamp measure overlay to view window; PR-TIMELINE-006/007.
- **2026-08-20** — Compact outside Δt label when selection too narrow; PR-TIMELINE-005.
- **2026-08-13** — Continuous overview/axis gutter (no mid-spacer horizontal rule); top chrome not resizable.
- **2026-08-13** — 4px gaps between Δt label and horizontal shaft segments.
- **2026-08-13** — Tip gap back to 1px.
- **2026-08-13** — Tip gap 3px; sharp miter tips; shaft overlaps to arm convergence.
- **2026-08-13** — Shaft overlaps chevrons; tip gap preserved without miter overshoot.
- **2026-08-13** — Δt arrow stroke 1.5px, color `rgba(49, 122, 247, 1)`.
- **2026-08-12** — Spec open stroke chevrons + 1px bar gap for Δt arrow; PR-TIMELINE-004.
- **2026-08-12** — Measure drag on time axis; PR-TIMELINE-003.
- **2026-08-12** — Measure markers on time axis (blue bars + arrow); overview stays for navigation; PR-TIMELINE-002.
- **2026-08-10** — Extracted from ProfilingReport main slot.
