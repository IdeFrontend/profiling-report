# SourceDiffPane

One side of the 源码对比 view: a read-only native Sudu Spektre `SideDiff` view driven by a
shared diff model, a header row naming the gutter/source/metric columns, and the
source-line metrics table for that side.

## Behaviour

- Rows arrive already aligned (`DiffRow[]`). The native `SideDiff` view owns the gutter,
  the removed and inserted line backgrounds, and the non-selectable spacers for a `null`
  line on this side.
- Metrics values are looked up by the row's **source** line and re-indexed onto the view
  row, so the table stays vertically aligned with the canvas after a hunk shifts lines.
- The header mirrors the normal Source pane (`#`, `Source`, then one label per metric
  column) and shares the row height, so line 1 starts level with metric row 1.
- The row height is measured once per theme from a temporary plain Sudu editor in a
  hidden host. `getFontSize()` is device pixels and is stored as CSS px (divided by
  the device pixel ratio). The editor is disposed and the host removed immediately;
  the cache re-measures when `window.devicePixelRatio` changes (browser zoom). A zoom
  restores the visible row after the new row height commits.
- The metrics file handed to the table omits `lineCount`, so the table extent is the
  view-row list. A source `lineCount` shorter than that list does not drop the tail.
- The metrics table is the scroll authority in CSS pixels; the pane converts to device
  pixels for `setVScrollPos` and converts editor scroll back through the device pixel
  ratio.
- The pane surface draws a focus ring only while its `focused` prop is set; the parent
  passes it for the pane the operator last pressed.

## Acceptance Criteria

- **PR-DIFF-101** A `changed` row renders through the shared native diff model in both panes; Sudu paints its own change backgrounds.
- **PR-DIFF-102** An `onlyLeft` row stays with the left pane; both panes receive the shared model, and the right pane shows the native spacer without an overlay.
- **PR-DIFF-103** Aligned rows drive the metrics table, and the native editor owns gutter numbers and filler spacers. A source `lineCount` shorter than the view-row list does not drop the tail rows.
- **PR-DIFF-104** The pane header labels the gutter `#`, the source column `Source`, and every metric column with its model label.
- **PR-DIFF-105** No tint overlay renders in the pane; the native `SideDiff` view paints row backgrounds inside the code plane.
- **PR-DIFF-106** Each pane is a `region` whose accessible name states its side.
- **PR-DIFF-107** A row this side lacks paints no overlay, and its metrics row stays blank: no capsule, no divider, no separator.
- **PR-DIFF-108** Every element inside the code plane has a computed `background-image` without `repeating-linear-gradient`; the metric hatch belongs only to rows that carry values.
- **PR-DIFF-110** A browser-zoom change (device pixel ratio) re-measures the row height and keeps the top visible source row; a second resize at the same ratio does not re-measure or re-scroll.
- **PR-DIFF-111** The code plane sends theme index `15` (`#432224`) for rows only the left file has, index `17` (`#432224`) for rows only the right file has, and index `23` (`#463520`) for a changed row both files have. The library paints those hexes verbatim. The design has exactly two band states: the metrics table repeats the band per row kind — removed `#472628`, modified `#4a3924` — and a row this side lacks carries no tint. Untinted rows do not highlight on hover. A 1 px `#2a2a2a` divider sits on the metrics plane's left edge, and every untinted, non-blank metrics row draws a 1 px `#2a2a2a` bottom line with an inset box-shadow so its 18 px height never changes; tinted and blank rows draw none. The header keeps `#2a2a2a` with a 1 px `#353535` bottom edge.
- **PR-DIFF-112** The pane bar shows the workspace pick button (`source-diff-workspace-${side}`) only when `workspaceAvailable` is true. The button uses the pane-bar icon style and the `workspaceTitle` label, and a click emits `pick-workspace` with no payload.
