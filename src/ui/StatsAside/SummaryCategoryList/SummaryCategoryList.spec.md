# SummaryCategoryList

| spec-id-prefix |
|----------------|
| PR-SUMM-*      |

Searchable `summary.jsonl` category field list used under **All** block scope in compute/memory 详情 overlays (DATA-19 / DATA-29). Same tabs + search + match-chip chrome as [`CsvFieldListPanel`](../CsvFieldListPanel/CsvFieldListPanel.spec.md) (UI-43); values come from summary category fields instead of a CSV row.

## Inputs

- **categories** — `SummaryCategory[]` (one tab per category).
- **activeId** — optional; which category tab is selected (parent-owned).
- **locale** — optional.

## Outputs

- **update:activeId** — when the user picks a tab.

## Behavior

1. Tabs list categories; selecting a tab switches the field list.
2. Search hides fields whose keys do not contain the query (case-insensitive substring). A match paints that slice as a navy chip with light-blue text, flush to the surrounding label (no pad). Values stay unchanged. Zero matches leave the list empty (no extra copy). The query persists across tab switches. Clear (×) empties the query and restores the full list.
3. Field list shows key → value for the active category. Show literal `NA` when present.

## Acceptance Criteria

1. **PR-SUMM-001** — Renders a tab per category; switching tabs changes visible fields.
2. **PR-SUMM-002** — Search filters and highlights matching keys (same chip tokens as PR-CSV-003 / UI-43).
3. **PR-SUMM-003** — Zero matches leave an empty list; query survives tab switch.

## Visual

Same search / match tokens as [CsvFieldListPanel](../CsvFieldListPanel/CsvFieldListPanel.spec.md):

| Token | Value |
|-------|--------|
| Search | radius `4px`; fill `#262626`; stroke magnifying-glass SVG `12×12` `#9a9a9a`; focus border `#3078f0` |
| Search match | substring chip: fill `#1d283c`, text `#688aec` weight `600`, radius `3px`, pad `0`; rest of label `#8e8e8e`; non-matching rows hidden |
| Field key | `#8e8e8e`; value `#e6e6e6` right-aligned |

## Changelog
- **2026-09-23** — Add search filter + substring highlight (parity with CsvFieldListPanel / UI-43) so All-scope 详情 is not search-less.
