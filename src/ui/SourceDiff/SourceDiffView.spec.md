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
- Scroll sync is always on: one pane's wheel is mirrored into the other through `setScrollCss`.
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
- **PR-DIFF-204** Compare mode pairs the open report with the selected checked baseline's source correlation; the toolbar's operator select seeds that baseline's default operator. Leaving the Source tab or loading a new report resets compare mode.
- **PR-DIFF-211** An explicit exit (the toolbar 退出对比 or Escape) lands on the Source tab while `sourceTabEnabled`; programmatic resets (new report, baseline collision) keep the current tab.
- **PR-DIFF-205** `data/source-diff/demo.npu-rep` loads as three correlated `left` / `mid` / `right` operators whose first source file carries 3 metric columns and starts on the missing-source placeholder (`// missing source embed:`) with no embedded text; a workspace pick of the three loose `.asc` files refills every leaf, and the refilled `left` vs `right` delta is 5 lines.
- **PR-DIFF-206** Every `data/source-diff/demo.npu-rep` leaf carries four entries, including a donor `PipeTrace.json` entry (type 2), and adapts a swimlane for the left, mid, and right sides.
- **PR-DIFF-207** `Navigate By` defaults to the first metric column and keeps the same column selected in both panes; scroll sync is always on and the pane bar renders no link toggle.
- **PR-DIFF-109** A pointerdown on a pane host moves the focus ring to that pane; exactly one pane carries the focused class, and the left pane is focused by default.
- **PR-DIFF-210** Both panes receive one shared diff model built from the two file texts; a text change rebuilds it, disposes the old model, and both panes adopt the replacement.
- **PR-DIFF-212** Two correlations with disjoint file paths still render a left/right pane pair through the first-file fallback, and the view does not throw.
- **PR-DIFF-213** Each pane's workspace button follows its own side: the left button tracks `currentWorkspaceAvailable`, the right tracks `baselineWorkspaceAvailable`. They emit `pick-current-workspace` / `pick-baseline-workspace` and carry the open-report / baseline labels.
- **PR-DIFF-214** A workspace pick of the three loose `.asc` files refills every `data/source-diff/demo.npu-rep` leaf: each file keeps real `HwdefectFind` text, three distinct signatures remain, no placeholder survives, the left-vs-right delta is 5 lines, and the right side resolves `sharpen2.asc`.
- **PR-DIFF-216** An absent baseline correlation does not throw: the view still renders the open-report left pane and an explicit empty right pane with the localized `sourceDiffBaselineEmpty` hint. No right workspace button renders without a hook.
- **PR-DIFF-217** A baseline correlation with an empty `files` list renders the same explicit empty right pane; with `baselineWorkspaceAvailable` the button carries `source-diff-workspace-right`, is `disabled`, and its title is the localized `sourceDiffWorkspaceBaselineDisabled` hint.
