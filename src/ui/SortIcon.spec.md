# SortIcon

| spec-id-prefix |
|----------------|
| PR-SORT-*      |

Compact inline SVG that renders one of three sort-direction glyphs for use in sortable column headers.

## Inputs

- **direction** — `'asc' | 'desc' | null`. `null` = unsorted (double-arrow ↕). `'asc'` = up-arrow ↑. `'desc'` = down-arrow ↓.

## Behavior

Renders an inline SVG. `null` shows the unsorted double-arrow glyph (up-triangle + horizontal divider + down-triangle). `'asc'` shows only the up-triangle. `'desc'` shows only the down-triangle. Icon is `aria-hidden="true"` — the parent button supplies the accessible label. Inherits color via `currentColor`.

## Acceptance Criteria

1. **PR-SORT-001** — null renders unsorted double-arrow.
2. **PR-SORT-002** — asc renders up-arrow only.
3. **PR-SORT-003** — desc renders down-arrow only.

## Changelog

- **2026-09-10** — Initial spec.
