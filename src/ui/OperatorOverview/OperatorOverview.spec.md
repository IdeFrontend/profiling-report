# OperatorOverview

| spec-id-prefix |
|----------------|
| PR-OVW-*       |

概览 tab: operator table, static 低利用率 dock, and fixed underutilization banner.

## Inputs

**rows** (`ReportOperatorRow[]`) — one row per `OpBasicInfo.csv` row across the operator pack, in adapter order. Every field is optional: an absent operator, type, demangled name, duration, or dimension stays absent rather than defaulting to zero. Optional **locale** selects the zh-CN or en copy.

## Behavior

The table has eight columns in mock order: 序号, OpName, Optype, DemangledName, Task Duration, BlockDim, Grid Size, Block Size. A ninth MixBlockDim column renders between BlockDim and Grid Size only when at least one visible row carries a value. 序号 numbers the visible rows from 1. The header stays visible while the body scrolls. When a column is narrow, the label truncates with an ellipsis and the filter/sort glyph keeps its 10px box; the filter count badge stays visible. OpName shows the short symbol in the cell, while its filter options list the raw values, so signatures that shorten to the same symbol stay distinct; DemangledName keeps the full signature and filtering matches the raw `opName` value. OpName and Optype carry a filter button; DemangledName, Task Duration, BlockDim, MixBlockDim, Grid Size, and Block Size carry sort buttons. Both glyphs are interactive controls.

Clicking a sort header cycles none → asc → desc → none; none restores the original report order. Numbers compare numerically and strings with `localeCompare` on the rendered text; missing values sort last in both directions. The header button's `th` carries `aria-sort` (`ascending` / `descending` / `none`). 序号, OpName, and Optype are not sortable.

Clicking a filter button opens a popover under the header with a checkbox list of the distinct values present in the unfiltered rows, sorted, capped at 240px with overflow. The popover renders in a fixed-position teleport on `document.body`, so the table never gains scroll height and the list is never clipped; it closes on Escape, a click outside, a second funnel click, or a scroll outside the table. Scrolling the table or resizing the window repositions it under its funnel, clamped to the viewport. Escape is consumed by the popover and returns focus to the funnel, so the host never also handles that key. The list is multi-select; an empty selection means no filter. A 清除 row clears the column filter, and an active filter shows a count badge on the header. Filters and sorting compose. The 序号 cell keeps the visible-row index.

The table is single-select. The first row is highlighted on mount. Clicking, Enter, or Space on another row moves the one highlight. Filtering keeps the selection while the selected row stays visible and clears it otherwise; it never auto-selects a visible row. A new `rows` array resets the filters, sort, open popover, and selection, then highlights the first row of the new pack. Task Duration renders with two decimals; 序号 and the dimension columns render values as produced. The table carries `role="grid"`, its rows `role="row"`, headers `role="columnheader"`, and body cells `role="gridcell"` so `aria-selected` on a row is valid.

Below the table sits the 低利用率 dock: a donut icon, a bold 低利用率 label, the muted 预计本地加速比: 88.69% line, the 选中算子的优化建议 link, and a right-aligned 执行优化 button with a leading open-corner rounded document glyph with two inner lines and a lower-left sparkle. The optimization link re-selects the highlighted row and never navigates. The 执行优化 button renders enabled and emits `optimize` with `{ opName }` of the highlighted row. The dock and the banner render only when at least one row is present. The bottom banner carries the fixed underutilization copy.

The table box hugs its rows (`flex: 0 1 auto`, `max-height: 100%`) and scrolls when rows overflow. Column widths are inline percentages that total 100 with the 序号 column included, so the rendered table never overflows its scroller horizontally. Header rows are 36px and data rows 32px at 12px; numeric cells are right-aligned and text cells left-aligned. The selected row uses a blue-grey fill with white text declared on its cells, which beats the default cell color; hover uses a lighter tint and there is no zebra striping.

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
16. **PR-OVW-016** — 执行优化 emits `optimize` with the highlighted `opName`.
17. **PR-OVW-017** — Suggestions link keeps highlighted row selected.
18. **PR-OVW-018** — OpName shows the short symbol; DemangledName and filter options keep the raw value.
19. **PR-OVW-019** — Popover escapes the table scroll container.
20. **PR-OVW-020** — Non-reactive rows highlight and select correctly.
21. **PR-OVW-021** — New rows reset filter, sort, popover, and selection.
22. **PR-OVW-022** — Column widths total 100% with MixBlockDim.
23. **PR-OVW-023** — Filter options keep raw values that shorten alike.
24. **PR-OVW-024** — Escape closes only the popover and restores funnel focus.
25. **PR-OVW-025** — Funnel controls the popover through `aria-controls`.
26. **PR-OVW-026** — Empty rows render no dock, banner, or numbers.
27. **PR-OVW-027** — Popover follows table scroll and clamps to the viewport.

## Changelog
- **2026-11-12** — Spec introduced with the 概览 tab (1130 mock).
- **2026-11-12** — Duration formatting and grid ARIA roles (PR-OVW-009/010).
- **2026-11-12** — Interactive sort/filter, MixBlockDim column, dock and optimize wiring (PR-OVW-012/017).
- **2026-11-12** — Palette and metrics follow the 1130 mock measurements (flat page, 30px header, 32px rows).
- **2026-11-13** — Review fixes: raw filter options, `{ opName }` optimize payload, 100% column widths, cell-level selected color, popover reposition/clamp, Escape isolation and focus, `aria-controls`, state reset on new rows, empty-pack guard (PR-OVW-020…027).
