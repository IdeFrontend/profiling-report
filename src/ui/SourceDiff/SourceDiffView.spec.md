# SourceDiffView

Side-by-side 源码对比 surface: current operator source on the left, baseline operator
source on the right, aligned by `alignSourceLines`.

## Behaviour

- Rows are recomputed whenever either side's file or the operator pair changes; the two
  panes always receive the same row list, so line N of a pane sits on view row N.
- Scroll sync mirrors one pane's wheel into the other through `setScrollCss`.
- Navigation mirrors the Source tab: find next/previous walks rows with `Navigate By`
  data, highest/lowest jump to the extreme values, sort asc/desc step the value order,
  and Enter in the search field walks text matches. All scroll both panes.
- Escape exits compare mode; the parent drops the compare chrome and returns to the
  single-file Source pane.
- The bottom dock keeps both `Source` sub-panes under each tab. Inline Functions lists the
  names declared `inline` in each file's own text; Source Markers and Statistics each show
  their labelled empty state until a data model exists. The centered chevron in the tab
  row collapses and expands only the two dock panes.

## Acceptance Criteria

- **PR-DIFF-201** Escape on the view emits `exit`.
- **PR-DIFF-203** The dock renders the three tabs and two `Source` sub-panes.
- **PR-DIFF-204** Entering compare mode preselects the first operator that is not the current one; leaving the Source tab resets compare mode; switching the current operator keeps compare mode and re-picks a fresh baseline when it equals the old one.
- **PR-DIFF-205** `data/source-diff/demo.npu-rep` loads as three correlated `left` / `mid` / `right` operators whose first source file carries 3 metric columns; the `left` vs `right` delta is 5 lines.
- **PR-DIFF-206** Each dock tab renders distinct content: inline function names derived from the source text, or a labelled empty state for markers and statistics; both sub-panes persist.
- **PR-DIFF-207** `Navigate By` defaults to the first metric column and keeps the same column selected in both panes; the pane-bar link button toggles shared scroll sync and reflects it with `aria-pressed`.
- **PR-DIFF-208** The centered dock toggle collapses and expands the dock panes, keeps the tab row visible, and flips `aria-expanded`.
