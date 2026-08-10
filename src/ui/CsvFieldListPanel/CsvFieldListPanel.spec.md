# CsvFieldListPanel

| spec-id-prefix |
|----------------|
| PR-CSV-*       |

Reusable searchable CSV field list with tabs, optional block switcher, and 查看全部 (I-Q6c / I-Q6d, [changes.png] #3–#4).

## Inputs

- **tables** — `CsvTableModel[]` (one per tab; hide empty).
- **csvTexts** — `Record<string, string>` raw CSV by `fileName` for 查看全部.
- **locale** — optional.
- **showBlockSwitcher** — when true (default), show block picker if any table has `blockIds`.

## Outputs

- **view-full-csv** — `{ fileName: string; text: string }` when 查看全部 clicked for the active tab.

## Behavior

1. Tabs list present tables; selecting a tab switches the field list.
2. Default block = first `blockId` of the active table (I-Q6c). Rows filtered to that `block_id` when a block is selected.
3. Search filters header names (case-insensitive substring).
4. Field list shows header → value for the first matching row of the selected block (or all columns from that row). Show literal `NA`.
5. 查看全部 emits full CSV text for the active `fileName`.

## Acceptance Criteria

1. **PR-CSV-001** — Renders a tab per table; switching tabs changes visible fields.
2. **PR-CSV-002** — Block switcher filters rows by `block_id`.
3. **PR-CSV-003** — Search narrows field labels.
4. **PR-CSV-004** — 查看全部 emits `view-full-csv` with fileName + text.

## Design sketches

- [changes.png](../../../docs/source/changes/changes.png) #3–#4
- [pipe_details.png](../../../docs/specs/ui/source/v930/compute-load-detail.jpeg)

## Changelog
- **2026-08-07** — Initial M1 panel.
