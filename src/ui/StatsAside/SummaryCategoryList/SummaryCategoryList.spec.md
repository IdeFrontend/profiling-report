# SummaryCategoryList

| spec-id-prefix |
|----------------|
| PR-SUMM-*      |

Searchable `summary.jsonl` category field list used under **All** block scope in compute/memory 详情 overlays (DATA-19 / DATA-29). Same tabs + search + match-chip chrome as [`CsvFieldListPanel`](../CsvFieldListPanel/CsvFieldListPanel.spec.md) (UI-43); values come from summary category fields instead of a CSV row.

## Inputs

- **categories** — `SummaryCategory[]` (one tab per category).
- **activeId** — optional; which category tab is selected (parent-owned).
- **locale** — optional.
- **comparisonCategories** — optional, `{ label, categories }[]`: every comparison row's categories for the multi-baseline hover popup (row 0 is also the inline `baselineCategories`).
- **comparisonCurrentLabel** — the current report's label inside the hover popup (parent i18n).

## Outputs

- **update:activeId** — when the user picks a tab.

## Behavior

1. Tabs list categories; selecting a tab switches the field list.
2. Search hides fields whose keys do not contain the query (case-insensitive substring). A match paints that slice as a navy chip with light-blue text, flush to the surrounding label (no pad). Values stay unchanged. Zero matches leave the list empty (no extra copy). The query persists across tab switches. Clear (×) empties the query and restores the full list.
3. Field list shows key → value for the active category. Show literal `NA` when present. Values are **left-aligned** in their column (the 1130 diff-detail mockup), and a baseline delta sits on the same line **after** its value — never in a separate right-hand column.

## Acceptance Criteria

1. **PR-SUMM-001** — Renders a tab per category; switching tabs changes visible fields.
2. **PR-SUMM-002** — Search filters and highlights matching keys (same chip tokens as CsvFieldListPanel / UI-43).
3. **PR-SUMM-003** — Zero matches leave an empty list; query survives tab switch.
4. **PR-SUMM-004** — With `baselineCategories`, a field whose numeric value differs from the baseline's gets a tone badge with the **unsigned** bare delta **after** its value (details show DELTAS); the tone's arrow carries the direction, so a rise is a plain positive and a fall is the same magnitude with no minus sign, matching the popup rows (PR-SUMM-007). The badge shares the value's flex line wrapper, so it sits on the SAME line right after the value and never wraps under it; non-numeric or equal fields carry none.
5. **PR-SUMM-005** — Field VALUES display at most four decimals ([formatDetailValue](../../../domain/detailValue.ts)): binary-float residue is rounded away (`0.9796212499999999` → `0.9796`, `1.50000` → `1.5`); a value already inside the ceiling keeps its printed precision (`2.0`, `0.77`); a sub-1 magnitude whose four-decimal rounding would flatten to `0` keeps five significant digits instead (`0.000012345` stays visible); non-numeric strings pass through.
6. **PR-SUMM-006** — Values and their baseline deltas align to the **left** edge of the value column (1130 diff-detail mockup): the value column is `text-align: left` and the value + delta line is left-justified, so every row's numbers start at the same x and the delta follows its own value.
7. **PR-SUMM-007** — With `comparisonCategories` (one or more rows), each field's inline badge opens the shared teleported baseline popup: the CURRENT value first, then every row's own value and **unsigned** bare delta (paired by category id + field key; the badge carries the direction). A single row included. The inline badge is **not a tab stop** (dense field lists): the same list is exposed through `aria-describedby` text, while the popup remains on hover; without the prop the badge keeps its unchanged inline chrome.

## Visual

Same search / match tokens as [CsvFieldListPanel](../CsvFieldListPanel/CsvFieldListPanel.spec.md):

| Token | Value |
|-------|--------|
| Search | radius `4px`; fill `#262626`; stroke magnifying-glass SVG `12×12` `#9a9a9a`; focus border `#3078f0` |
| Search match | substring chip: fill `#1d283c`, text `#688aec` weight `600`, radius `3px`, pad `0`; rest of label `#8e8e8e`; non-matching rows hidden |
| Field key | `#8e8e8e`; value `#e6e6e6` left-aligned (PR-SUMM-006) |


## Changelog
- **2026-11-25** — Review fixes: sub-`1e-4` values keep their significant digits instead of printing `0` (PR-SUMM-005), and the inline details badge is described rather than a per-row tab stop (PR-SUMM-007).
- **2026-11-24** — Product review: the inline details badge prints the bare magnitude too — no minus sign on a green (decrease) badge, the arrow carries the direction (PR-SUMM-004 restated); the popup and inline badges now read the same.
- **2026-11-23** — Product review: the hover popup prints bare magnitudes (no minus on green); the inline details badge keeps its signed value.
- **2026-11-23** — Details deltas print the sign (1130 dsl guide): a decrease reads `-5.00`, an increase a plain positive.
- **2026-11-23** — Multi-baseline details popup (PR-SUMM-007): `comparisonCategories` drive the shared hover popup; the inline badge stays row 0.
- **2026-11-23** — Details pages read value-first from the left edge (PR-SUMM-006, 1130 `diff-detail` mockup): values are left-aligned and the baseline delta follows its own value on the same line.
- **2026-11-19** — Product review: the field delta badges read through the panel's ONE two-decimal format (PR-STATS-060) — `0.2` becomes `0.20`; field VALUES keep their own ≤4-decimal rule (PR-SUMM-005).
- **2026-11-12** — 对比基线 details: delta badges right of field values (PR-SUMM-004).
- **2026-09-23** — Add search filter + substring highlight (parity with CsvFieldListPanel / UI-43) so All-scope 详情 is not search-less.
