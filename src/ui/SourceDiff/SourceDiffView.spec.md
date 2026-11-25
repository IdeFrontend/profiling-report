# SourceDiffView

Side-by-side 源码对比 surface: current operator source on the left, baseline operator
source on the right, aligned by `alignSourceLines`. Both panes render through native
Sudu `SideDiff` views fed by one shared diff model.

## Behaviour

- Rows are recomputed whenever either side's file or the operator pair changes; the two
  panes always receive the same row list, so line N of a pane sits on view row N.
- One worker pool and one diff model are shared by both panes. The model rebuilds when
  either text or language changes, and the previous model is disposed after the panes
  adopt the replacement. Unmount disposes the current model; the pool stays cached.
- Removed and inserted lines come from the native editor; the view paints no tint layer.
- Scroll sync mirrors one pane's wheel into the other through `setScrollCss`.
- Navigation mirrors the Source tab: find next/previous walks rows with `Navigate By`
  data, highest/lowest jump to the extreme values, sort asc/desc step the value order,
  and Enter in the search field walks text matches. All scroll both panes.
- Escape exits compare mode; the parent drops the compare chrome and returns to the
  single-file Source pane.
- The focus ring follows the last pressed pane: a pointerdown on either pane host makes
  that pane the focused one, and the left pane starts focused.
- No bottom dock: the two panes fill the view height.

## Acceptance Criteria

- **PR-DIFF-201** Escape on the view emits `exit`.
- **PR-DIFF-203** The view renders no bottom dock: no `tablist`, no dock tab test ids.
- **PR-DIFF-204** Entering compare mode preselects the first operator that is not the current one; leaving the Source tab resets compare mode; switching the current operator keeps compare mode and re-picks a fresh baseline when it equals the old one.
- **PR-DIFF-211** An explicit exit (the toolbar 退出对比 or Escape) lands on the Source tab while `sourceTabEnabled`; programmatic resets (new report, baseline collision) keep the current tab.
- **PR-DIFF-205** `data/source-diff/demo.npu-rep` loads as three correlated `left` / `mid` / `right` operators whose first source file carries 3 metric columns; the `left` vs `right` delta is 5 lines.
- **PR-DIFF-206** Every `data/source-diff/demo.npu-rep` leaf carries a donor `PipeTrace.json` entry (type 2) and adapts a swimlane for the left, mid, and right sides.
- **PR-DIFF-207** `Navigate By` defaults to the first metric column and keeps the same column selected in both panes; the pane-bar link button toggles shared scroll sync and reflects it with `aria-pressed`.
- **PR-DIFF-109** A pointerdown on a pane host moves the focus ring to that pane; exactly one pane carries the focused class, and the left pane is focused by default.
- **PR-DIFF-210** Both panes receive one shared diff model built from the two file texts; a text change rebuilds it, disposes the old model, and both panes adopt the replacement.
