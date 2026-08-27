# MultiSelectSummary

| spec-id-prefix |
|----------------|
| PR-MSEL-*      |

Bottom dock replacing DetailPanel when the user selects multiple events via marquee drag: count header, "Slices" tab, sortable metrics table.

## Inputs

**selectedEvents** (`SwimEvent[]`) — the events captured by the marquee rect; the parent resolves IDs to full objects. **model** (`SwimlaneModel`) — used to compute the "Average Wall Duration" column (mean duration of all model events sharing the same name, not just selected). **unit** (`TimeDisplayUnit`) — display unit inherited from the root. Optional **locale** localizes labels. **height** — dock height in px (same session-only ownership as DetailPanel).

## Outputs

**close** — the header × button; the parent clears the multi-selection, which unmounts the dock. **select-single** (`SwimEvent`) — clicking an event name in the table transitions from multi-select to single-select: the parent mounts DetailPanel for that event and clears multi-selection. **update:height** — dock resize forwarded to the root (same `panelResize` pattern).

## Behavior

### Panel chrome

Same dock position and resize mechanics as DetailPanel: raised bottom panel, shared `panelResize` on the vertical axis, height clamped so the dock never swallows the timeline. The drag resize handle (▴ triangle) sits between the last swimlane row and the panel header.

The header bar reads **"{count} items selected."** on the left, followed by the **Slices ({count})** tab label with an accent underline (same pattern as the 详情 tab in DetailPanel), and the **×** close button on the right.

### Slices table

A scrollable table body under the header. Four columns:

| # | Header | Content | Bar |
|---|--------|---------|-----|
| 1 | **Name** | `SwimEvent.name`; styled as a blue underlined link | — |
| 2 | **Wall Duration** | `formatTimeParts(event.duration, unit)` | proportional bar |
| 3 | **Self time** | Same as `duration` (events are flat; see Q23 for future `selfTime` field) | proportional bar |
| 4 | **Average Wall Duration** | Mean `duration` across **all model** events sharing the same `name` (not just selected) | proportional bar |

Each numeric column shows the formatted value and a small inline horizontal bar proportional to the column maximum (`value / columnMax`). The bar sits inline right of the value, with a muted fill on a darker track.

Column headers carry a **sort toggle** — the opposed-triangle mark drawn by [SortArrows](../SortArrows.spec.md), identical on every column. Clicking cycles ascending → descending → unsorted. Default sort: Wall Duration descending. The sorted column is marked by its label brightening, not by a changed glyph.

**Name click** emits **select-single** with the full `SwimEvent`, transitioning to single-select + DetailPanel.

Every cell that truncates carries its full text in `title` (same convention as DetailSummary).

### Marquee interaction (owned by SwimlaneCanvas)

An **unmodified drag** (>4px threshold on either axis) on the canvas draws the marquee rectangle: 1px border `rgba(66,133,244,0.8)`, fill `rgba(66,133,244,0.15)`. The rect tracks the pointer on both axes (time × lane Y). The marquee passes through Card header strips — only rendered leaf events whose rects **intersect** the marquee bounds are collected. Below the threshold the press is still a click, so click-to-select is unchanged.

**Gesture precedence:** `measureMode` wins. While the caliper is on, an unmodified drag creates / resizes `measureRange` as before and never marquees; the marquee is only available with measure mode off. Time-axis panning is **Shift+wheel** or a two-finger horizontal trackpad scroll — drag no longer pans, so the marquee does not have to fight it.

**Commit (pointerup):** emit **`multi-select(SwimEvent[])`** with every intersecting event, then clear the rect. A rect that hits nothing commits an empty array, which the root reads as "clear the selection" — it drops both the multi-selection and any single selection. Either way the root emits `select(null)` upstream: the single selection is gone whether the commit emptied everything or swapped it for a multi-selection, so hosts read `select(null)` as "no single selection" (contract: [ProfilingReport Outputs](../ProfilingReport/ProfilingReport.spec.md)).

**Cancel:** Escape during drag cancels without committing. `pointerleave` does **not** cancel (bound on `window`, same pattern as measure-border resize); the press still owns pointerup, so a cancelled marquee never falls through to `select` or `set-playhead`.

**Δt chrome:** while the rect is live the viewport time axis shows the **same** measure UI — blue edge bars, double-sided Δt arrow, duration label — over the marquee's time extent (`[min(t0,t1), max(t0,t1)]`). On commit the span switches to the selected-event **hull** (`[min(starts), max(ends)]`) and persists until the multi-selection clears (empty-space click, Escape, dock close, empty marquee commit). Geometry is TimelineView's existing Δt path, not a second style; the bars are inert (nothing to resize — the span follows the selection).

**Post-commit rendering:** selected events keep full opacity and everything else dims through the **same** `eventEmphasisDim` path single-click selection uses (non-selected-when-selection = **0.45**, composed with search the same way) — multi-select is `setSelection`'s dim level, not a new one. No dependency curves for multi-select.

**Tooltip:** suppressed during marquee drag (`hover` emits `null`).

### Multi-select vs single-select

The panel and DetailPanel are mutually exclusive — only one mounts at a time. ProfilingReport decides which:

- `multiSelectedIds.length > 0` → mount MultiSelectSummary
- `selectedEventId != null` → mount DetailPanel
- both empty → neither mounts

Setting a multi-selection clears any single selection (and vice versa). Clicking empty space on the canvas clears both. **Escape** also clears multi-selection (and the measure overlay, independently — one Escape drops whichever are active).

## Acceptance Criteria

1. **PR-MSEL-001** — header with "{count} items selected." and "Slices ({count})" tab label.
2. **PR-MSEL-002** — table lists all selected events with four columns.
3. **PR-MSEL-003** — column sort toggles; default Wall Duration descending.
4. **PR-MSEL-003b** — headers carry [SortArrows](../SortArrows.spec.md); sorted column highlighted.
4. **PR-MSEL-004** — inline proportional bars in each numeric cell.
5. **PR-MSEL-005** — Name click emits `select-single`.
6. **PR-MSEL-006** — header × emits `close`.
7. **PR-MSEL-007** — dock resizable via top-edge drag handle, clamped.
8. **PR-MSEL-008** — table body scrolls when rows exceed available height.

## Edge Cases

| State | Behavior |
|---|---|
| 0 events selected | Panel does not mount (guard in parent) |
| Empty marquee commit (0 intersecting) | `multi-select([])` → root clears both selections; no dock, no Δt chrome |
| 1 event via marquee | Panel still mounts (single-row table); Name click transitions to DetailPanel |
| All durations identical | Every bar fills to 100% |
| Very long event name | Truncate with ellipsis; `title` carries full text |

## Visual

Normative crops: [`visual/info-panel.png`](./visual/info-panel.png), [`visual/selection.png`](./visual/selection.png) — [`visual/provenance.yaml`](./visual/provenance.yaml).

## Design sketches

- [info-panel](./visual/info-panel.png) — bottom panel: header + sortable table from `v930/task-marquee`
- [selection](./visual/selection.png) — marquee rectangle over timeline from `v930/task-marquee`
- <source frame> — `/docs/ui/source/v930/task-marquee.jpeg`

Design hierarchy: [`docs/ui/DESIGN_INDEX.md`](../../../docs/ui/DESIGN_INDEX.md).

## Dependencies

[format-time](../../../specs/core/format-time.spec.md) for value formatting. [DetailPanel](../DetailPanel/DetailPanel.spec.md) for shared dock chrome pattern.

### Cross-spec changes required

#### SwimlaneCanvas — marquee interaction (PR-CANVAS-027…033)

- **Unmodified drag** (>4px): draw marquee rect; collect intersecting leaf events; emit **`multi-select(SwimEvent[])`** on pointerup (empty array when nothing intersects). `measureMode` wins that gesture while it is on.
- Drag no longer pans: **`pan`** now comes from **Shift+wheel** and trackpad horizontal `deltaX`.
- Live rect emits **`multi-select-span`** (its time extent) for the axis Δt chrome; `null` on end/cancel.
- Cancel with Escape; `pointerleave` does not cancel (window-bound).
- Post-commit: full opacity on selected, `eventEmphasisDim` (0.45, the `setSelection` level) on the rest, no dependency curves.
- Renderer gains optional **`setMultiSelection(ids: string[])`** (empty clears dim); `layout` gains `eventsIntersectingRect`.

#### TimelineView — multi-select Δt (PR-TIMELINE-018)

Axis Δt chrome is driven by **multiSelectSpan** when measure mode is off (live marquee extent, then the committed hull); bars are inert. `focus-measure` carries the span it describes.

#### ProfilingReport — state ownership (PR-ROOT-007)

Root holds the captured `SwimEvent[]` and handles `multi-select`, `multi-select-span`, `close`, `select-single`, empty-space click, and Escape. It owns the Δt span shown for a multi-selection: the live drag extent, then the committed hull, cleared whenever the selection is. Exclusivity lives in **view-state** (`setSelectedEvent` / `setMultiSelection` / `clearSelection`), not in each caller.

#### view-state — new field

`SwimlaneViewState.multiSelectedIds: string[]` (default `[]`), plus `setSelectedEvent` / `setMultiSelection` / `clearSelection` (PR-VIEW-012).

#### SwimlaneRenderer interface

`setMultiSelection?(ids: string[]): void` — optional, like `setDependencyMode` / `setDependencyDepth`, so existing implementers stay valid (PR-RENDER-015/016).

## Open

- **Q23** — Self time data source. See [OPEN_QUESTIONS Q23](../../../docs/context/OPEN_QUESTIONS.md). Interim: Self time = duration (events are flat).
- **Q22 (resolved)** — Multi-select does **not** drive aside recomputation: local panel only, like the measure overlay. See [OPEN_QUESTIONS resolution log](../../../docs/context/OPEN_QUESTIONS.md).

## Changelog

- **2026-08-27** — Commit wording aligned with the root's `select` contract: `select(null)` fires on every commit and means "no single selection", not "nothing is selected".
- **2026-08-26** — Sort mark is the drawn [SortArrows](../SortArrows.spec.md) pair, not a `◇` text span; header color corrected to `#999999` and the label gap to 9px against the sketch.
- **2026-08-26** — Header × is the shared [CloseButton](../CloseButton.spec.md): the typographic `×` sits on the font's math axis and never centered in its button.
- **2026-08-26** — Product gesture rules: unmodified drag marquees (measure mode wins), pan moves to Shift+wheel / trackpad horizontal scroll, and the axis Δt chrome persists over the multi-select span (live extent → committed hull). Post-commit dim corrected to the shared `eventEmphasisDim` 0.45, not 25%. Empty-commit behavior spelled out.
- **2026-08-25** — Implemented. Marquee lives on SwimlaneCanvas (PR-CANVAS-027…031); dim parity + rect collection in the renderers (PR-RENDER-015/016); exclusivity helpers in view-state (PR-VIEW-012); root ownership (PR-ROOT-007). Empty commit = clear.
- **2026-08-24** — Initial spec. Q22/Q23 escalated to OPEN_QUESTIONS.
