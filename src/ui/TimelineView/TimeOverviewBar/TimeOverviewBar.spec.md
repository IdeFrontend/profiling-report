# TimeOverviewBar

| spec-id-prefix |
|----------------|
| PR-OVERVIEW-*  |

Full timeline preview bar with a draggable/resizable window indicator representing the visible viewport. Allows rapid navigation to any region of a long trace without zooming and panning through the main canvas.

## Inputs

The component receives the full timeline bounds (**minTime**, **maxTime**) and the current visible window (**startTime**, **endTime**) in the parent's internal time units (nanoseconds). **timeUnit** controls label formatting.

## Outputs

A single event: **update:window** carries `{ startTime, endTime }` continuously on pointer move while dragging (live scrubbing), and on a bare track click. The parent ProfilingReport applies each update via `applyWindow`.

## Behavior

**Proportional mapping.** Window position and size are computed as percentages of the total span: `left = (startTime - minTime) / span`, `width = (endTime - startTime) / span`. When the window covers the full timeline, the indicator fills the entire bar.

**Relative tick labels.** Overview axis labels format `t − minTime` so the leftmost tick is compact **0** in the active unit (`0ms` / `0µs` / `0ns`). Absolute source timestamps must not appear.

**Shared ruler chrome.** Overview and viewport axes share `AxisRuler`: track height **20px**; labels in an **18px** top-aligned box at **12px / 400**; major **1px** bars with labels immediately to the **right**; **9** minor ticks (**5px** tall) between each major pair. Majors use a zoom-aware nice ns grid (`1|2|5×10ⁿ`, ~100px spacing) snapped to `origin + k·interval` so tick **positions** reflow with zoom/pan. Majors/minors outside the selected window are muted. `AxisRuler` clips its own overflow so labels never paint into the right aside; the overview track leaves **horizontal** overflow visible so edge range handles are not cropped left/right.

**Drag modes.** The window indicator supports three operations: move the entire window, resize from the left handle, resize from the right handle. Handles are a **vertical 4×10 white pill** on a **1px stem** (see **Visual**). The pill sits flush inside the top **10px** of the track (does **not** extend above the axis); stem runs from the pill bottom to the track bottom. Edge handles may paint past the track’s left/right bounds. Pointer events initiate a drag mode; pointer move adjusts window boundaries and emits `update:window` continuously. A click on the track (with no drag) emits `update:window` to jump to the clicked position.

**Parent integration.** The parent ProfilingReport receives the `update:window` event and applies the new window to `SwimlaneViewState` via `applyWindow`. All children re-render with the updated viewport.

## Visual

Axis chrome: [`AxisRuler.spec.md`](../TimeAxis/AxisRuler/AxisRuler.spec.md). Crops: [`visual/range-handles.png`](./visual/range-handles.png), [`visual/handle.png`](./visual/handle.png) — [`visual/provenance.yaml`](./visual/provenance.yaml).

### Overview range handles

| Token | Value |
|-------|--------|
| Head | Vertical white pill **exactly 4×10 px**, `border-radius: 2px`, centered on stem; flush in the top 10px of the track |
| Stem | `1px` solid `#ffffff`, from bottom of head (`top: 10px`) to track bottom |
| Direction | Head is taller than wide (4×10 CSS) |
| Hit target | ≥12px wide invisible hit area centered on stem |
| Window fill | Selected: `rgba(255,255,255,0.06)`; outside dimmed via track |
| Vertical | Handle head must **not** extend above the overview track / time axis (`top: 0`, no negative offset) |
| Horizontal | Edge handles are **not** cropped left/right; track overflow stays visible horizontally |

## Acceptance Criteria

1. **PR-OVERVIEW-001** — Renders timeline bar.
2. **PR-OVERVIEW-002** — Indicator covers correct proportion of the timeline.
3. **PR-OVERVIEW-003** — Leftmost tick label is relative zero (`0ms` / `0µs` / `0ns`).
4. **PR-OVERVIEW-004** — Ruler renders majors on a nice grid with minors between; `AxisRuler` clips tick overflow vs aside.
5. **PR-OVERVIEW-005** — Handle tab is exactly `width: 4px; height: 10px; top: 0` (no vertical protrusion); overview track uses `overflow: visible` so left/right edge handles are not cropped.

## Edge Cases

| State | Behavior |
|---|---|
| minTime equals maxTime | Bar renders; `fullSpan` clamps to 1; all ticks collapse to minTime |
| Window covers full timeline | Indicator fills entire bar, handles at edges |
| Very short window (<1% of span) | Handles merge visually but are independently draggable |
| startTime < minTime or endTime > maxTime | Indicator may escape track bounds on render (clamped only on emit) |

## Design sketches

- [range-handles](./visual/range-handles.png) — from `v930/entry`
- [handle](./visual/handle.png) — from `v930/entry` (left/right share one glyph)
- [Statistical analysis (overview charts)](../../../../docs/ui/source/v930/entry.jpeg)

## Changelog
- **2026-08-13** — Handle head 4×10 flush vertically; horizontal edge uncrop via track `overflow: visible`; PR-OVERVIEW-005.
- **2026-08-07** — Handle head **4×10**.
- **2026-08-07** — Axis chrome: 20px track, 5px minors, 18px / 12px/400 labels.
- **2026-08-07** — Zoom-aware nice major grid (`calculateGridInterval`); positions reflow with zoom.
- **2026-08-07** — Shared AxisRuler chrome (22px/10px, major bars + label-right, 9 minors).
- **2026-08-07** — Relative axis origin (left = 0); edge-aligned ticks; clip overflow vs aside.
- **2026-08-07** — Handle head 4×12 vertical pill (was horizontal flag).
- **2026-08-07** — Flag handles (1px stem + outward top tab) per visual crops.
- **2026-08-05** — Initial spec. Core behaviors established.
