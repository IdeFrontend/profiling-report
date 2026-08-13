# CsvFieldListPanel

| spec-id-prefix |
|----------------|
| PR-CSV-*       |

Reusable searchable CSV field list with tabs, optional block switcher, and 查看全部 (I-Q6c / I-Q6d; sketches `v930/compute-load-detail`, `v930/memory-load-detail`).

## Inputs

- **tables** — `CsvTableModel[]` (one per tab; hide empty).
- **csvTexts** — `Record<string, string>` raw CSV by `fileName` for 查看全部.
- **locale** — optional.
- **showBlockSwitcher** — when true (default), show block picker if any table has `blockIds`.
- **selectedBlockId** — optional v-model; parent (StatsAside) owns the id so topology labels stay in sync.

## Outputs

- **view-full-csv** — `{ fileName: string; text: string }` when 查看全部 clicked for the active tab.
- **update:selectedBlockId** — when the block picker changes.

## Behavior

1. Tabs list present tables; selecting a tab switches the field list.
2. Default block = first `blockId` of the active table (I-Q6c), or the bound **selectedBlockId**. Rows filtered to that `block_id` when a block is selected.
3. Search filters header names (case-insensitive substring).
4. Field list shows header → value for the first matching row of the selected block (or all columns from that row). Show literal `NA`.
5. 查看全部 emits full CSV text for the active `fileName`.

## Acceptance Criteria

1. **PR-CSV-001** — Renders a tab per table; switching tabs changes visible fields.
2. **PR-CSV-002** — Block switcher filters rows by `block_id`.
3. **PR-CSV-003** — Search narrows field labels.
4. **PR-CSV-004** — 查看全部 emits `view-full-csv` with fileName + text.

## Visual

Crops: [`visual/tabs-search.png`](./visual/tabs-search.png), [`visual/field-rows.png`](./visual/field-rows.png), [`visual/block-switcher.png`](./visual/block-switcher.png) — [`visual/provenance.yaml`](./visual/provenance.yaml).

| Token | Value |
|-------|--------|
| Active tab underline | `2px solid #ffffff` (label width; not playhead blue) |
| Inactive tab | `#9a9a9a` |
| Search | radius `4px`; stroke magnifying-glass SVG `12×12` `#9a9a9a` |
| Block pill | bg `#2a2a2a`; radius `4px`; custom chevron; no native arrow |
| 查看全部 | `#c8c8c8` `12px` |
| Field key | `#8e8e8e`; value `#e6e6e6` right-aligned |
| Field list | fills leftover overlay height; `overflow: auto` (no `max-height` cap) |

## Design sketches

- [tabs-search](./visual/tabs-search.png) — from `v930/compute-load-detail`
- [field-rows](./visual/field-rows.png) — from `v930/compute-load-detail`
- [block-switcher](./visual/block-switcher.png) — from `v930/memory-load-detail`
- [compute-load-detail](../../../../docs/ui/source/v930/compute-load-detail.jpeg) — full frame
- [memory-load-detail](../../../../docs/ui/source/v930/memory-load-detail.jpeg) — full frame

## Changelog
- **2026-08-13** — Field list fills overlay; drop max-height cap.
- **2026-08-13** — Optional `selectedBlockId` v-model; crop token table.
- **2026-08-07** — Initial M1 panel.
