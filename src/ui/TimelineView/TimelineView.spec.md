# TimelineView

| spec-id-prefix |
|----------------|
| PR-TIMELINE-*  |

Left-column stack: overview bar, time axis, and SwimlaneView body. Gutter width CSS var is owned here; the resize handle lives on the SwimlaneView body (see `SwimlaneView.spec.md`). Overview/axis top chrome is **not** resizable.

## Behavior

**Top chrome gutter.** Overview and viewport-axis gutter spacers form one continuous block: **no** horizontal border between those two spacer cells. (Timeline-column borders between overview track and viewport axis may remain.)

**Measure mode (M2).** The overview bar stays visible for window navigation (no measure span is drawn on it). The viewport time axis draws blue vertical bars at **true** measured-range edges that fall inside the current view, plus a double-sided Δt arrow across the visible measure span, and accepts the same drag-to-measure gesture as the swimlane. Geometry for the shaft/label **clamps to the current view window**; a bar and arrowhead are **not** drawn for an edge that is only clamped onto the view boundary (that would falsely read as the selection ending at the screen edge). When the range is **fully outside** the view, the axis keeps a one-sided **offscreen cue** at the near edge (pointing chevron + Δt just inside; **no** vertical edge bar). Δt label always uses the full measured duration. During swimlane appear/clear tweens (range↔visible window), the Δt arrow and label are hidden while bars/fades still animate; they stay visible when tweening between two non-empty ranges. Swimlane fade/gray borders live in `SwimlaneCanvas`.

**Δt arrow geometry (v930).** Each arrowhead is an **open stroke chevron** (single path, `fill="none"`, sharp **miter** tip — not bevelled/flat). The visible tip sits **1px** inward from the adjacent vertical measure bar. The shaft overlaps deep into each chevron until it meets the arms (no gap between shaft and arrow lines). The Δt duration label sits centered on the arrow with a **4px gap** on each side between the label chrome and the horizontal shaft (shaft breaks around the label; they do not touch). Shaft and chevron strokes are **1.5px** wide in solid `rgba(49, 122, 247, 1)`.

**Narrow selection.** When the measured span’s pixel width is smaller than pads + heads + shaft–label gaps + label width, park the duration pill **outside** the bars (prefer **4px to the right** of the right bar; if that would clip, **4px to the left** of the left bar) while still drawing the two-sided arrow between the bars. When the span is so narrow that the arrowheads would overlap (`<` pads + both heads ≈ **20px**), hide heads **and** the horizontal shaft; only the outside duration label remains between/near the vertical bars.

**Cursor vs measure chrome.** Hovering the **viewport time axis** keeps the cursor timestamp visible and lifts it **above** the axis (`labelAbove`) so the pill does not cover tick labels (same placement as measure-overlap lift), and keeps the **full-height swimlane playhead** in sync via the shared `cursor` prop. When a measure overlay is visible and the pill overlaps the selected range (playhead inside, or playhead just outside with the pill crossing a border) or covers an outside / offscreen Δt label, the pill also lifts above. Otherwise (pointer over the swimlane, clear of measure chrome) it stays in-track. Hovering a measure edge bar **sticks** the cursor to that border (does not hide the timestamp); leaving the bar onto empty axis keeps the lifted axis cursor. Overview/axis rows stay `overflow: visible` with stacking above the aside so edge handles and the cursor pill are not clipped at the main/aside seam.

**Edge resize.** Axis blue bars are 9px hit pads with a 1px stem (`col-resize`); hover/active thickens the stem to 2px. Dragging left/right moves that edge only (**other edge fixed**, including when it lies outside the current view); the dragged edge is clamped to the view window with a ~1px min span. Resize listens on `window` for move/up so releasing over Card strips (above the bars) still ends the drag. Empty-axis drag still creates a new measure range; create/resize use the swimlane event-edge magnet when the pointer is over the canvas (axis-started drags included).

**Focus measure.** Clicking the Δt duration pill emits `focus-measure`. The parent animates the viewport so the measured range is centered and spans half the visible width (~400ms ease-out; instant when `prefers-reduced-motion`).

## Acceptance Criteria

1. **PR-TIMELINE-001** — Renders overview, time axis, and swimlane body regions.
2. **PR-TIMELINE-002** — When `view.measureMode` and `view.measureRange` are set, the time axis shows blue bars and a Δt arrow; the overview bar remains rendered.
3. **PR-TIMELINE-003** — In measure mode, drag on the time axis emits `update:measure-range`.
4. **PR-TIMELINE-004** — Measure arrow: sharp miter stroke chevrons, **1px** tip–bar gap, shaft overlaps into heads, **4px** shaft–label gaps; 1.5px stroke; `rgba(49, 122, 247, 1)`.
5. **PR-TIMELINE-005** — When the selection is too narrow for an in-between label but wide enough for both heads, the label sits outside the range and the two-sided arrow still spans the bars.
6. **PR-TIMELINE-006** — When a measure edge lies outside the view, that bar and arrowhead are omitted (shaft/label still span the visible intersection); both edges outside → no bars/heads.
7. **PR-TIMELINE-007** — When the range is fully outside the view, the axis shows a near-edge offscreen cue (one pointing head + Δt; no vertical edge bar), not an empty axis.
8. **PR-TIMELINE-008** — When the selection is so narrow that arrowheads would overlap, hide heads and the horizontal shaft; keep only the outside duration label.
9. **PR-TIMELINE-009** — With a visible measure range, cursor pill overlapping the selection (inside, or outside with label crossing a border) uses above-axis placement; cursor clear of the range stays in-track.
10. **PR-TIMELINE-010** — Dragging an axis measure bar resizes that edge (other edge fixed); bars use a 9px hit pad, `col-resize`, and a 2px stem.
11. **PR-TIMELINE-011** — Hovering an axis measure bar emits `cursor` stuck to that edge (timestamp stays visible / lifts above).
12. **PR-TIMELINE-012** — Clicking the Δt label emits `focus-measure`.
13. **PR-TIMELINE-013** — Hovering the viewport time axis emits `cursor`, lifts the timestamp above the ticks, and shows the swimlane vertical playhead at the same x (default and measure mode).
14. **PR-TIMELINE-014** — Axis-started measure drag magnetizes the moving edge when the pointer moves over the swimlane (same as canvas-started drag); emitted `cursor` uses the magnetized `time` and matching `xRatio` (not raw pointer x).
15. **PR-TIMELINE-015** — Cursor label uses scalar `formatTime` (producer timestamp) when `minTime ≠ 0`.

## Changelog
- **2026-08-24** — Scalar `formatTime` cursor labels; PR-TIMELINE-015.

- **2026-08-23** — Axis magnet path emits cursor `xRatio` from swimlane magnet, not raw pointer x; PR-TIMELINE-014.
- **2026-08-23** — Axis measure range borders use a 2px stem (not 1px / hover-only); PR-TIMELINE-010.
- **2026-08-23** — Axis measure create/resize uses swimlane magnet when pointer is over canvas; PR-TIMELINE-014.
- **2026-08-20** — Hide Δt arrow/label during swimlane appear/clear tweens.
- **2026-08-20** — Viewport-axis hover keeps lifted timestamp + swim playhead; PR-TIMELINE-013.
- **2026-08-20** — Click Δt label emits focus-measure; PR-TIMELINE-012.
- **2026-08-20** — Offscreen cue is chevron + Δt only (no edge bar); PR-TIMELINE-007.
- **2026-08-20** — Offscreen near-edge cue; omit clamped fake bars/heads; PR-TIMELINE-006/007.
- **2026-08-20** — Hover measure bar sticks cursor; PR-TIMELINE-011.
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
