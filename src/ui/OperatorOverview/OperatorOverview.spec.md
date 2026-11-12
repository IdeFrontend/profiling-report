# OperatorOverview

| spec-id-prefix |
|----------------|
| PR-OVW-*       |

概览 tab: operator table, static 低利用率 dock, and fixed underutilization banner.

## Inputs

**rows** (`ReportOperatorRow[]`) — one row per `OpBasicInfo.csv` row across the operator pack, in adapter order. Every field is optional: an absent operator, type, demangled name, duration, or dimension stays absent rather than defaulting to zero. Optional **locale** selects the zh-CN or en copy.

## Behavior

The table has eight columns in mock order: 序号, OpName, Optype, DemangledName, Task Duration, BlockDim, Grid Size, Block Size. A ninth MixBlockDim column renders between BlockDim and Grid Size only when at least one visible row carries a value. 序号 numbers the visible rows from 1. The header stays visible while the body scrolls. When a column is narrow, the label truncates with an ellipsis and the filter/sort glyph keeps its 10px box; the filter count badge stays visible. OpName shows the short symbol and its filter options use that short name, while DemangledName keeps the full signature; filtering still matches the raw `opName` value. OpName and Optype carry a filter button; DemangledName, Task Duration, BlockDim, MixBlockDim, Grid Size, and Block Size carry sort buttons. Both glyphs are interactive controls.

Clicking a sort header cycles none → asc → desc → none; none restores the original report order. Numbers compare numerically and strings with `localeCompare` on the rendered text; missing values sort last in both directions. The header button's `th` carries `aria-sort` (`ascending` / `descending` / `none`). 序号, OpName, and Optype are not sortable.

Clicking a filter button opens a popover under the header with a checkbox list of the distinct values present in the unfiltered rows, sorted, capped at 240px with overflow. The popover renders in a fixed-position teleport on `document.body`, so the table never gains scroll height and the list is never clipped; it closes on Escape, a click outside, a second funnel click, or window scroll/resize. The list is multi-select; an empty selection means no filter. A 清除 row clears the column filter, and an active filter shows a count badge on the header. Filters and sorting compose. The 序号 cell keeps the visible-row index.

The table is single-select. The first row is highlighted on mount. Clicking, Enter, or Space on another row moves the one highlight. Filtering keeps the selection while the selected row stays visible and clears it otherwise; it never auto-selects a visible row. Task Duration renders with two decimals; 序号 and the dimension columns render values as produced. The table carries `role="grid"`, its rows `role="row"`, headers `role="columnheader"`, and body cells `role="gridcell"` so `aria-selected` on a row is valid.

Below the table sits the 低利用率 dock: a donut icon, a bold 低利用率 label, the muted 预计本地加速比: 88.69% line, the 选中算子的优化建议 link, and a right-aligned 执行优化 button with a leading open-corner rounded document glyph with two inner lines and a lower-left sparkle. The optimization link re-selects the highlighted row and never navigates. The 执行优化 button renders enabled and emits `optimize` to the host. The bottom banner carries the fixed underutilization copy.

The table box hugs its rows (`flex: 0 1 auto`, `max-height: 100%`) and scrolls when rows overflow. Header rows are 36px and data rows 32px at 12px; numeric cells are right-aligned and text cells left-aligned. The selected row uses a blue-grey fill with white text; hover uses a lighter tint and there is no zebra striping.

## Acceptance Criteria

1. **PR-OVW-001** — Eight table headers match mock.
2. **PR-OVW-002** — One row per operator entry.
3. **PR-OVW-003** — Missing values render empty cells.
4. **PR-OVW-004** — First row selected by default.
5. **PR-OVW-005** — Row click moves single highlight.
6. **PR-OVW-006** — Dock shows 低利用率 summary.
7. **PR-OVW-007** — 执行优化 button renders enabled.
8. **PR-OVW-008** — Banner shows underutilization copy.
9. **PR-OVW-009** — Task Duration renders two decimals; dimensions render as-is.
10. **PR-OVW-010** — Table exposes grid, row, columnheader, gridcell roles.
11. **PR-OVW-011** — Filter glyph on OpName and Optype.
12. **PR-OVW-012** — Sort header cycles asc, desc, none.
13. **PR-OVW-013** — Filter popover multi-selects distinct values.
14. **PR-OVW-014** — Clear row resets one column filter.
15. **PR-OVW-015** — MixBlockDim renders only with values.
16. **PR-OVW-016** — 执行优化 emits optimize.
17. **PR-OVW-017** — Suggestions link keeps highlighted row selected.
18. **PR-OVW-018** — OpName shows short symbol; DemangledName keeps signature.
19. **PR-OVW-019** — Popover escapes the table scroll container.

## Changelog
- **2026-11-12** — Spec introduced with the 概览 tab (1130 mock).
- **2026-11-12** — Duration formatting and grid ARIA roles (PR-OVW-009/010).
- **2026-11-12** — Interactive sort/filter, MixBlockDim column, dock and optimize wiring (PR-OVW-012/017).
- **2026-11-12** — Palette and metrics follow the 1130 mock measurements (flat page, 30px header, 32px rows).
