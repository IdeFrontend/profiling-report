# OperatorOverview

| spec-id-prefix |
|----------------|
| PR-OVW-*       |

概览 tab: operator table, data-derived utilization dock, and conditional underutilization banner.

## Inputs

**rows** (`ReportOperatorRow[]`) — one row per `OpBasicInfo.csv` row across the operator pack, in adapter order. Every field is optional: an absent operator, type, demangled name, duration, or dimension stays absent rather than defaulting to zero. Optional **pipeOccupancy** (`PipeOccupancyItem[]`) carries the per-pipe ratios that drive the dock utilization line; it defaults to an empty array. Optional **selectedOperatorId** (`string`) names the pack the host wants highlighted; it stays absent in host-managed mode. Optional **locale** selects the zh-CN or en copy.

## Behavior

The table has eight columns in mock order: 序号, OpName, Optype, DemangledName, Task Duration, BlockDim, Grid Size, Block Size. A ninth MixBlockDim column renders between BlockDim and Grid Size only when at least one visible row carries a value. 序号 numbers the visible rows from 1. The header stays visible while the body scrolls. When a column is narrow, the label truncates with an ellipsis and the filter/sort glyph keeps its 10px box; the filter count badge stays visible. OpName shows the short symbol in the cell, while its filter options list the raw values, so signatures that shorten to the same symbol stay distinct; DemangledName keeps the full signature and filtering matches the raw `opName` value. OpName and Optype carry a filter button; DemangledName, Task Duration, BlockDim, MixBlockDim, Grid Size, and Block Size carry sort buttons. Both glyphs are interactive controls.

Clicking a sort header cycles none → asc → desc → none; none restores the original report order. Numbers compare numerically and strings with `localeCompare` on the rendered text; missing values sort last in both directions. The header button's `th` carries `aria-sort` (`ascending` / `descending` / `none`). 序号, OpName, and Optype are not sortable.

Clicking a filter button opens a popover under the header with a checkbox list of the distinct values present in the unfiltered rows, sorted, capped at 240px with overflow. The popover renders in a fixed-position teleport on `document.body`, so the table never gains scroll height and the list is never clipped; it closes on Escape, a click outside, a second funnel click, or a scroll outside the table. Opening the other column's filter moves the popover and keeps a single set of document listeners, so leaving the tab does not swallow a later Escape. Scrolling the table or resizing the window repositions it under its funnel, clamped to the viewport. Escape is consumed by the popover and returns focus to the funnel, so the host never also handles that key. The list is multi-select; an empty selection means no filter. A 清除 row clears the column filter, and an active filter shows a count badge on the header. Filters and sorting compose. The 序号 cell keeps the visible-row index.

The table is single-select. The first row is highlighted on mount. Clicking, Enter, or Space on another row moves the one highlight. Only the selected row is a tab stop (`tabindex="0"`); every other row is `-1`, and when no row is selected the first visible row is the tab stop. With focus on a row, ArrowUp/ArrowDown move the selection and DOM focus by one within the visible rows; Home/End jump to the first/last row. Arrow keys are ignored while the filter popover is open. Filtering keeps the selection while the selected row stays visible and clears it otherwise; it never auto-selects a visible row. Setting **selectedOperatorId** to a pack the filter has hidden clears the highlight instead of selecting that hidden row, so the first visible row is the tab stop and 执行优化 stays disabled. A new `rows` array resets the filters, sort, open popover, and selection, then highlights the row for **selectedOperatorId** when that pack is in the new rows, otherwise the first row. Task Duration renders with two decimals; 序号 and the dimension columns render values as produced. The table carries `role="grid"`, its rows `role="row"`, headers `role="columnheader"`, and body cells `role="gridcell"` so `aria-selected` on a row is valid. Clicking a row whose pack id differs from **selectedOperatorId** emits `update:selectedOperatorId` with that id and leaves that row highlighted when the host writes the id back. Setting the prop otherwise highlights the first visible row of that pack, clears the highlight when every row of the pack is filtered out, and leaves the highlight untouched when no row matches. The OpName cell is a button that selects its row and emits `openTimeline`, with a pointer cursor and the link blue on hover and focus. Enter and Space on that button stay with the button; the same keys on the rest of the row select it.

Below the table sits the 低利用率 dock: a donut icon, the utilization line, the 选中算子的优化建议 link, and a right-aligned 执行优化 button with a leading open-corner rounded document glyph with two inner lines and a lower-left sparkle. The utilization line reads `流水线利用率: {value}` / `Pipeline utilization: {value}`, where `{value}` is the peak pipe ratio rounded to a percentage (`Math.round(peak * 100)%`) and `peak = max(item.ratio)` over **pipeOccupancy**. An empty **pipeOccupancy** renders `—`. The bold 低利用率 label renders only when `peak < 0.5`. The optimization link is disabled until a suggestions surface ships and never navigates. The 执行优化 button is enabled only while the highlighted row carries a non-blank Op Name; clicking it emits `optimize` with `{ opName }` of that row. The dock renders only when at least one row is present. The bottom banner renders only when at least one row is present and `peak < 0.5`; it carries the fixed underutilization copy.

**Assumption.** The 0.5 underutilization threshold is an evidential heuristic, not a measured contract: shipped fixtures sit on both sides of it (gather_2d peak 0.994, example.npu.rep peak 0.381), so a full pipeline stays quiet while a sparse one warns. Revisit the threshold if real packs cluster near 0.5.

The table box hugs its rows (`flex: 0 1 auto`, `max-height: 100%`) and scrolls when rows overflow. Column widths are inline percentages normalized from their declared proportions so they total exactly 100 with the 序号 column included, with or without MixBlockDim, so the rendered table never overflows its scroller horizontally. Header rows are 30px and data rows 32px at 12px; numeric cells are right-aligned and text cells left-aligned. The selected row uses a blue-grey fill with white text declared on its cells, which beats the default cell color; hover uses a lighter tint and there is no zebra striping.

## Acceptance Criteria

1. **PR-OVW-001** — Eight table headers match mock.
2. **PR-OVW-002** — One row per operator entry.
3. **PR-OVW-003** — Missing values render empty cells.
4. **PR-OVW-004** — First row selected by default.
5. **PR-OVW-005** — Row click moves single highlight.
6. **PR-OVW-006** — Dock shows the utilization line from the peak pipe ratio and the 低利用率 chip when peak < 0.5.
7. **PR-OVW-007** — 执行优化 button is enabled only when the highlighted row has an Op Name and emits `optimize` on click.
8. **PR-OVW-008** — Underutilization banner renders only when peak pipe ratio < 0.5.
9. **PR-OVW-009** — Task Duration renders two decimals; dimensions render as-is.
10. **PR-OVW-010** — Table exposes grid, row, columnheader, gridcell roles.
11. **PR-OVW-011** — Filter glyph on OpName and Optype.
12. **PR-OVW-012** — Sort header cycles asc, desc, none.
13. **PR-OVW-013** — Filter popover multi-selects distinct values.
14. **PR-OVW-014** — Clear row resets one column filter.
15. **PR-OVW-015** — MixBlockDim renders only with values.
16. **PR-OVW-016** — 执行优化 emits `optimize` with the highlighted `opName`.
17. **PR-OVW-017** — Suggestions link stays disabled until a suggestions surface ships; it keeps the highlighted row.
18. **PR-OVW-018** — OpName shows the short symbol; DemangledName and filter options keep the raw value.
19. **PR-OVW-019** — Popover escapes the table scroll container.
20. **PR-OVW-020** — Non-reactive rows highlight and select correctly.
21. **PR-OVW-021** — New rows reset filter, sort, popover, and selection, keeping the selected pack.
22. **PR-OVW-022** — Column widths total 100% with or without MixBlockDim.
23. **PR-OVW-023** — Filter options keep raw values that shorten alike.
24. **PR-OVW-024** — Escape closes only the popover; switching filters does not stack listeners.
25. **PR-OVW-025** — Funnel controls the popover through `aria-controls`.
26. **PR-OVW-026** — Empty rows render no dock, banner, or utilization numbers.
27. **PR-OVW-027** — Popover follows table scroll and clamps to the viewport.
28. **PR-OVW-028** — Dock utilization renders the computed percentage in both locales without a sample marker.
29. **PR-OVW-029** — Row click emits `update:selectedOperatorId` with the row pack id.
30. **PR-OVW-030** — OpName button emits `openTimeline`; Space stays on the button.
31. **PR-OVW-031** — `selectedOperatorId` highlights that pack, keeps the activated row, and clears a hidden pack.
32. **PR-OVW-032** — Mounting with `selectedOperatorId` set highlights that pack's first row, not the first row of the flattened list.
33. **PR-OVW-033** — Roving tabindex: exactly one row is a tab stop, ArrowUp/ArrowDown move selection and focus, and Home/End reach the first/last row.
34. **PR-OVW-034** — Rows without pipe data render an em dash and hide the chip and banner.

## Changelog
- **2026-11-12** — Spec introduced with the 概览 tab (1130 mock).
- **2026-11-12** — Duration formatting and grid ARIA roles (PR-OVW-009/010).
- **2026-11-12** — Interactive sort/filter, MixBlockDim column, dock and optimize wiring (PR-OVW-012/017).
- **2026-11-12** — Palette and metrics follow the 1130 mock measurements (flat page, 30px header, 32px rows).
- **2026-11-13** — Review fixes: raw filter options, `{ opName }` optimize payload, 100% column widths, cell-level selected color, popover reposition/clamp, Escape isolation and focus, `aria-controls`, state reset on new rows, empty-pack guard (PR-OVW-020…027).
- **2026-11-13** — Speedup string uses a `{value}` placeholder with a visible sample marker; suggestions link disabled until suggestions ship (PR-OVW-017/028).
- **2026-11-19** — Roving tabindex with ArrowUp/ArrowDown/Home/End row navigation (PR-OVW-033).
- **2026-11-19** — Column widths normalize to exactly 100% with or without MixBlockDim (PR-OVW-022).
- **2026-11-19** — Dock utilization derives from the peak `pipeOccupancy` ratio; peak < 0.5 drives the chip and banner, and empty pipe data renders `—` (PR-OVW-006/008/028/034).
- **2026-11-23** — A filtered-out `selectedOperatorId` clears the highlight; a rows swap keeps that pack when it is still present; Enter/Space on the OpName button are not cancelled (PR-OVW-021/030/031).
- **2026-11-23** — Writing `selectedOperatorId` back after a row click keeps that row when it belongs to the pack; a host change still highlights the first visible row of the pack (PR-OVW-031).
- **2026-11-23** — Switching filter columns keeps one set of document listeners (PR-OVW-024).
