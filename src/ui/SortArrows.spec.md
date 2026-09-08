# SortArrows

| spec-id-prefix |
|----------------|
| PR-SORTICON-*  |

The sort affordance drawn beside a sortable column header — a pair of opposed hollow triangles.

## Inputs

None. The mark is identical on every column in the sketch, so it carries no state; the header button owns `aria-sort` and the sorted column is marked by its label brightening.

## Outputs

None — decorative. The owning header button handles the click.

## Behavior

The sketch draws two hollow triangles mirrored across the icon's horizontal midline: apex up over apex down, each base facing the other. Drawn, not typed — `◇`, `▲▼` and friends render at the font's mercy (size, weight and baseline drift per platform, and the fallback font may not carry the glyph at all), which is why the previous `◇` text span matched neither the shape nor the weight of the sketch.

Mirroring is the point: a single arrow reads as "sorted this way", while the opposed pair reads as "this column can sort". Since the mark never changes, direction lives in `aria-sort` for assistive tech and in the label's brightened color for sighted users.

## Acceptance Criteria

1. **PR-SORTICON-001** — two opposed hollow triangles, drawn not typed.

## Visual

8×12 px; 1px `currentColor` strokes, no fill; inherits the header's `#999999`, brightening with it on hover and when sorted. Sits 9px right of the label.

## Design sketches

- Table header row in `v930/task-marquee` — 33×48 device px at 4×, `#999999`, pixel-identical across all four columns.

Design hierarchy: [`docs/ui/DESIGN_INDEX.md`](../../docs/ui/DESIGN_INDEX.md).

## Dependencies

Used by [MultiSelectSummary](./MultiSelectSummary/MultiSelectSummary.spec.md) column headers.

## Changelog

- **2026-08-26** — Extracted from MultiSelectSummary, which drew the sort mark as a `◇` text span — wrong shape, wrong weight, font-dependent.
