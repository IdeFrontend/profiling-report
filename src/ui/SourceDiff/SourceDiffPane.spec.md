# SourceDiffPane

One side of the 源码对比 view: a read-only Sudu canvas driven by aligned diff rows,
a header row naming the gutter/source/metric columns, the source-line metrics table for
that side, and the change tint overlay.

## Behaviour

- Rows arrive already aligned (`DiffRow[]`), so a `null` line on this side is a filler row.
  Filler rows keep a blank gutter, which the mapped text model supports.
- Metrics values are looked up by the row's **source** line and re-indexed onto the view
  row, so the table stays vertically aligned with the canvas after a hunk shifts lines.
- The header mirrors the normal Source pane (`#`, `Source`, then one label per metric
  column) and shares the row height, so line 1 starts level with metric row 1.
- Tint bands live in a `pointer-events: none` overlay above the canvas and are blended
  with `mix-blend-mode: screen`, because Sudu has no row-background API. The gutter stays
  untinted; separate bands cover the code columns and the metric columns, so each plane
  keeps its own design tone. A row missing on this side gets no band at all: the pane
  background and empty gutter show through, with no hatch or other marker.
- Vertical scroll is mirrored to the parent through `scrollListener`; the parent decides
  which pane follows. Scroll echo uses the device-pixel sentinel from `editorTableSync`.

## Acceptance Criteria

- **PR-DIFF-101** A `changed` row paints a yellow tint band over the code columns and a matching tone over the metric columns.
- **PR-DIFF-102** An `onlyLeft` row paints brown on the left pane and no band on the right pane — only the pane background and empty gutter.
- **PR-DIFF-103** Gutter numbers follow the row's source line, and filler rows carry no `lineNumber`.
- **PR-DIFF-104** The pane header labels the gutter `#`, the source column `Source`, and every metric column with its model label.
- **PR-DIFF-105** The tint overlay is anchored to the pane body, so its bands reach the code and metric columns without tinting the gutter; it is not inside the editor host.
- **PR-DIFF-106** Each pane is a `region` whose accessible name states its side.
