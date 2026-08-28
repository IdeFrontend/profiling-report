# CsvFieldListPanel

| spec-id-prefix |
|----------------|
| PR-CSV-*       |

Reusable searchable CSV field list with tabs, optional block switcher, and 查看全部 (I-Q6c / I-Q6d; sketches `v930/compute-load-detail`, `v930/search-highlight`, `v930/memory-load-detail`).

## Inputs

- **tables** — `CsvTableModel[]` (one per tab; hide empty).
- **csvTexts** — `Record<string, string>` raw CSV by `fileName` for 查看全部.
- **locale** — optional.
- **showBlockSwitcher** — when true (default), show block picker if any table has `blockIds`. Compute overlay passes false (`v930/compute-load-detail` / `v930/search-highlight` have search only).
- **showViewAll** — when true (default), show 查看全部. Compute overlay passes false; memory overlay keeps it (`v930/memory-load-detail`).
- **selectedBlockId** — optional v-model; parent (StatsAside) owns the id so topology labels stay in sync.

## Outputs

- **view-full-csv** — `{ fileName: string; text: string }` when 查看全部 clicked for the active tab.
- **update:selectedBlockId** — when the block picker changes (not on tab switch).

## Behavior

1. Tabs list present tables; selecting a tab switches the field list.
2. Bound **selectedBlockId** when it is in the active table’s `blockIds`; otherwise an internal fallback to that table’s first `blockId` (I-Q6c). Only the block picker emits `update:selectedBlockId` — tab switches do not write through. Rows filtered to the displayed `block_id`.
3. Search hides fields whose headers do not contain the query (case-insensitive substring). A match paints that slice as a navy chip with light-blue text, flush to the surrounding label (no pad). Values stay unchanged. Clear (×) empties the query and restores the full list. Same rule on compute and memory overlays.
4. Field list shows header → value for the first matching row of the selected block (or all columns from that row). Show literal `NA`.
5. 查看全部 emits full CSV text for the active `fileName`.

## Acceptance Criteria

1. **PR-CSV-001** — Renders a tab per table; switching tabs changes visible fields.
2. **PR-CSV-002** — Block switcher filters rows by `block_id`.
3. **PR-CSV-003** — Search filters and highlights labels.
4. **PR-CSV-004** — 查看全部 emits `view-full-csv` with fileName + text.
5. **PR-CSV-005** — Tab switch does not emit `update:selectedBlockId` when the active table lacks the bound id; field list falls back internally.
6. **PR-CSV-006** — Flags hide block and 查看全部.

## Visual

Crops: [`visual/tabs-search.png`](./visual/tabs-search.png), [`visual/field-rows.png`](./visual/field-rows.png), [`visual/block-switcher.png`](./visual/block-switcher.png) — [`visual/provenance.yaml`](./visual/provenance.yaml).

| Token | Value |
|-------|--------|
| Active tab underline | `2px solid #ffffff` (label width; not playhead blue) |
| Inactive tab | `#9a9a9a` |
| Search | radius `4px`; fill `#262626`; stroke magnifying-glass SVG `12×12` `#9a9a9a`; focus border `#3078f0` |
| Search match | substring chip: fill `#1d283c`, text `#688aec` weight `600`, radius `3px`, pad `0` (flush; no gap); rest of label `#8e8e8e`; non-matching rows hidden |
| Block pill | bg `#2a2a2a`; radius `4px`; custom chevron; no native arrow |
| 查看全部 | `#c8c8c8` `12px` |
| Field key | `#8e8e8e`; value `#e6e6e6` right-aligned |
| Field list | fills leftover overlay height; `overflow: auto` (no `max-height` cap) |

## Design sketches

- [tabs-search](./visual/tabs-search.png) — from `v930/compute-load-detail`
- [field-rows](./visual/field-rows.png) — from `v930/compute-load-detail`
- [block-switcher](./visual/block-switcher.png) — from `v930/memory-load-detail`
- [compute-load-detail](../../../../docs/ui/source/v930/compute-load-detail.jpeg) — full frame
- [search-highlight](../../../../docs/ui/source/v930/search-highlight.jpeg) — search match chrome
- [memory-load-detail](../../../../docs/ui/source/v930/memory-load-detail.jpeg) — full frame

## Changelog
- **2026-08-28** — Search filters non-matching rows and still highlights the substring; match chip is flush (pad `0`). Same on compute and memory.
- **2026-08-24** — Search match is a navy chip + light-blue semi-bold text (`v930/search-highlight`).
- **2026-08-24** — Compute overlay omits block + 查看全部 (`v930/search-highlight`); `showViewAll` flag.
- **2026-08-24** — Search highlights matching label substrings; focus border + clear (`v930/search-highlight`).
- **2026-08-14** — Tab switch keeps bound block; internal fallback only (PR-CSV-005).
- **2026-08-13** — Field list fills overlay; drop max-height cap.
- **2026-08-13** — Optional `selectedBlockId` v-model; crop token table.
- **2026-08-07** — Initial M1 panel.
