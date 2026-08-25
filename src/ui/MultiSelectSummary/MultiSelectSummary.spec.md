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

Column headers carry a **sort toggle** (◇ diamond icon). Clicking cycles ascending → descending → unsorted. Default sort: Wall Duration descending.

**Name click** emits **select-single** with the full `SwimEvent`, transitioning to single-select + DetailPanel.

Every cell that truncates carries its full text in `title` (same convention as DetailSummary).

### Marquee interaction (owned by SwimlaneCanvas)

**Shift+drag** (>4px threshold on either axis) on the canvas draws the marquee rectangle: 1px border `rgba(66,133,244,0.8)`, fill `rgba(66,133,244,0.15)`. The rect tracks the pointer on both axes (time × lane Y). The marquee passes through Card header strips — only rendered leaf events whose rects **intersect** the marquee bounds are collected. Shift wins over measure mode: the same press cannot both marquee and measure.

**Commit (pointerup):** emit **`multi-select(SwimEvent[])`** with every intersecting event, then clear the rect. A rect that hits nothing commits an empty array, which the root reads as "clear the selection" — so `select(null)` stays the one signal a host listens to for "nothing is selected".

**Cancel:** Escape during drag cancels without committing. `pointerleave` does **not** cancel (bound on `window`, same pattern as measure-border resize); the press still owns pointerup, so a cancelled marquee never falls through to `select` or `set-playhead`.

**Post-commit rendering:** selected events at full opacity; everything else dims to 25% alpha (same dim level as single-click selection). No dependency curves for multi-select.

**Tooltip:** suppressed during marquee drag (`hover` emits `null`); pan is suppressed for the same press.

### Multi-select vs single-select

The panel and DetailPanel are mutually exclusive — only one mounts at a time. ProfilingReport decides which:

- `multiSelectedIds.length > 0` → mount MultiSelectSummary
- `selectedEventId != null` → mount DetailPanel
- both empty → neither mounts

Setting a multi-selection clears any single selection (and vice versa). Clicking empty space on the canvas clears both. **Escape** also clears multi-selection.

## Acceptance Criteria

1. **PR-MSEL-001** — header with "{count} items selected." and "Slices ({count})" tab label.
2. **PR-MSEL-002** — table lists all selected events with four columns.
3. **PR-MSEL-003** — column sort toggles; default Wall Duration descending.
4. **PR-MSEL-004** — inline proportional bars in each numeric cell.
5. **PR-MSEL-005** — Name click emits `select-single`.
6. **PR-MSEL-006** — header × emits `close`.
7. **PR-MSEL-007** — dock resizable via top-edge drag handle, clamped.
8. **PR-MSEL-008** — table body scrolls when rows exceed available height.

## Edge Cases

| State | Behavior |
|---|---|
| 0 events selected | Panel does not mount (guard in parent) |
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

#### SwimlaneCanvas — marquee interaction (PR-CANVAS-027…031)

- **Shift+drag** (>4px): draw marquee rect; collect intersecting leaf events; emit **`multi-select(SwimEvent[])`** on pointerup (empty array when nothing intersects).
- Cancel with Escape; `pointerleave` does not cancel (window-bound). A plain drag still pans.
- Post-commit: full opacity on selected, 25% dim on rest, no dependency curves.
- Renderer gains optional **`setMultiSelection(ids: string[])`** (empty clears dim); `layout` gains `eventsIntersectingRect`.

#### ProfilingReport — state ownership (PR-ROOT-007)

Root holds the captured `SwimEvent[]` and handles `multi-select`, `close`, `select-single`, empty-space click, and Escape. Exclusivity lives in **view-state** (`setSelectedEvent` / `setMultiSelection` / `clearSelection`), not in each caller.

#### view-state — new field

`SwimlaneViewState.multiSelectedIds: string[]` (default `[]`), plus `setSelectedEvent` / `setMultiSelection` / `clearSelection` (PR-VIEW-012).

#### SwimlaneRenderer interface

`setMultiSelection?(ids: string[]): void` — optional, like `setDependencyMode` / `setDependencyDepth`, so existing implementers stay valid (PR-RENDER-015/016).

## Open

- **Q23** — Self time data source. See [OPEN_QUESTIONS Q23](../../../docs/context/OPEN_QUESTIONS.md). Interim: Self time = duration (events are flat).
- **Q22 (resolved)** — Multi-select does **not** drive aside recomputation: local panel only, like the measure overlay. See [OPEN_QUESTIONS resolution log](../../../docs/context/OPEN_QUESTIONS.md).

## Changelog

- **2026-08-25** — Implemented. Marquee lives on SwimlaneCanvas (PR-CANVAS-027…031); dim parity + rect collection in the renderers (PR-RENDER-015/016); exclusivity helpers in view-state (PR-VIEW-012); root ownership (PR-ROOT-007). Empty commit = clear.
- **2026-08-24** — Initial spec. Q22/Q23 escalated to OPEN_QUESTIONS.
