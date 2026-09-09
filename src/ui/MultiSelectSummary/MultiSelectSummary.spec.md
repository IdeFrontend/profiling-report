# MultiSelectSummary

| spec-id-prefix |
|----------------|
| PR-MULTI-*     |

Info panel shown after a marquee box-select on the swimlane. Groups selected events by name and shows aggregate timing columns, each sortable via `SortIcon`. Sketches: `v930/task-marquee`.

## Inputs

- **rows** — `MultiSelectSummaryItem[]`. One entry per unique event name; each carries `name`, `wallDuration`, `selfTime`, `avgWallDuration` (all in nanoseconds). Empty array → empty-state message.
- **count** — `number`. Total events selected (headline badge).
- **locale** — optional.

## Outputs

- **close** — emitted when the × button is pressed.

## Behavior

Table has four columns: **Name** (left-aligned text), **Wall Duration**, **Self time**, **Average Wall Duration** (right-aligned formatted time values). All four column headers contain a `SortIcon` and are clickable.

Sort cycle per column: `null → asc → desc → null`. Clicking a *different* column resets direction to `asc`. Sort state is component-local and does not mutate the `rows` prop. The active column's `<th>` carries `aria-sort="ascending"` or `aria-sort="descending"`; inactive columns carry `aria-sort="none"`.

Header line shows formatted count ("N items selected." + "Slices (N)" badge). A × button emits `close`.

Empty rows shows a "No items selected" message in place of the table body.

## Acceptance Criteria

1. **PR-MULTI-001** — Renders all four column headers with SortIcon.
2. **PR-MULTI-002** — First click on a column → ascending sort; SortIcon shows up-arrow.
3. **PR-MULTI-003** — Second click same column → descending; third click resets to null.
4. **PR-MULTI-004** — Active sort reorders rows correctly; inactive columns show neutral icon.
5. **PR-MULTI-005** — aria-sort on th matches active sort state.
6. **PR-MULTI-006** — close emitted on × click; empty rows shows empty state; sort does not mutate prop.

## Visual

Crops: [`visual/info-panel.png`](./visual/info-panel.png), [`visual/selection.png`](./visual/selection.png) — [`visual/provenance.yaml`](./visual/provenance.yaml).

| Token | Value |
|-------|-------|
| Background | `#1e1e1e` |
| Header text | `#a0a0a0` |
| Row text | `#e0e0e0` |
| Border | `1px solid #2e2e2e` |
| Sort icon margin-left | `4px` |

## Changelog

- **2026-09-10** — Initial implementation (PR-MULTI-001..006).
