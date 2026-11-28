# BaselinePicker

| spec-id-prefix |
|----------------|
| PR-BASELINE-*  |

Baseline (对比基线) picker: a toolbar popover listing the app's reports as checkboxes. The checked set **is** the host-owned `baselines` list — every toggle applies immediately. The footer offers 添加报告文件 / **Add report file** and one right-hand action: 基线对比 / **Compare baselines** starts the comparison and closes the popover; while a comparison runs the same slot shows 取消对比 / **Cancel comparison**, which leaves the comparison without touching the checked set. There is no Add baseline step and no staged draft.

## Inputs

**baselines** (`Baseline[]` — `{ id, name, path, operators?, pickedAt? }`) is the host-owned checked list; the checkbox state derives from it and the picker keeps no private copy. **recentBaselines** (`Baseline[]`) is the host's own report list (MSTT: the Performance results tree; bundled web hosts: the demo list) — one checkbox row per entry; checked entries missing from it render as extra rows. **comparing** (`boolean`) reflects host-owned comparison rows (the root passes `baselineRows.length > 0`): while true the right-hand slot shows 取消对比 / **Cancel comparison**. **pickBaselineFile** (`() => Promise<BaselinePick | null>`) is the optional host hook for 添加报告文件 / **Add report file**; absent, the trigger is not rendered (the library never reads the filesystem — same contract as `resolveSourceFile`). **locale** localizes all copy.

## Outputs

- **update:baselines** (`Baseline[]`) — the new checked set, emitted immediately by every checkbox toggle and by 添加报告文件 / **Add report file**. The host owns persistence (session-only in the bundled web hosts; a real host persists).
- **compare-baselines** (`Baseline[]`) — emitted by 基线对比 / **Compare baselines** with the checked set; the root starts the comparison (one default row on the first checked baseline).
- **cancel-comparison** — emitted by 取消对比 / **Cancel comparison**; the root clears the comparison rows, the checked set stays.

## Behavior

**Trigger.** A square action-icon button (`data-testid="toggle-baselines"`) with the mockup's **add-baseline** glyph (extracted from `docs/ui/source/1130/add-baseline.jpeg`; provenance crop `docs/ui/review/icons/add-baseline-1130.png`), rendered only when `pickBaselineFile` is provided. It opens the popover and reflects the open state through `aria-expanded` and the `--on` class (shared action-icon states in the global `tokens.css`). Fallthrough attrs (the toolbar's `data-toolbar-clip`) bind to the trigger button, so the clip-inert scan and the right-aligned tooltip rule see the button, not the wrapper.

**Popover.** Anchored under the trigger, right-aligned, same panel tokens as 显示控制; width adapts to its content (240–480px) so full opprof run names fit; the body list caps at 260px with the teleported-menu scrollbar. Header: the list glyph + 基线 / **Baseline** title and a CloseButton (×). Transient popover — no OK/Cancel; every dismiss path simply closes it.

**Rows.** `recentBaselines` first, then checked entries missing from that list (browsed picks), deduped by `path` (the baseline identity). One row per report: a 16px checkbox (design square + white checkmark; the whole row is its label, the native input is sr-clipped), the **derived display title** (`baselineDisplayTitle`: filename + timestamp instead of a generated boilerplate id) and the dimmed path.

**Toggling.** Checking a row appends it to `baselines` via `update:baselines`; unchecking removes it — immediately, with no staged draft. Checking reuses the already-committed entry when one exists, so a render never replaces its id / host-declared `operators` / `pickedAt` with the display row's copy. Closing and reopening keeps whatever is checked (the host-owned list).

**Add report file.** The left footer action (`data-testid="baseline-browse"`, folder glyph) calls `pickBaselineFile()`. A `null` result or a rejected hook changes nothing. A pick appends `{ id, name, path, pickedAt }` (fresh id; name falls back to the path basename; `pickedAt` is the pick's mtime or the pick moment) to the checked set via `update:baselines` immediately. Re-picking an already-checked path emits nothing. The action stays available while comparing.

**Compare baselines.** The right-hand action (`data-testid="baseline-compare"`) emits `compare-baselines` with the checked set and closes the popover (focus returns to the trigger). Disabled (native `disabled`, 0.6 opacity) when nothing is checked.

**Cancel comparison.** While `comparing`, the same right-hand slot renders 取消对比 / **Cancel comparison** (`data-testid="baseline-cancel-compare"`) instead of Compare. It emits `cancel-comparison`; the popover stays open and the checked set is untouched.

**Dismiss.** The popover closes via the header ×, a second press of the trigger, a pointerdown outside the wrap (trigger + panel), or Escape — the same dismiss contract as 显示控制 and 快捷键说明. The component also **exposes `close()`** (`defineExpose`): the root calls it when the aside's Baseline / Operator bar is used, because the bar stops pointerdown and the popover's own outside-dismiss never sees those clicks; the exposed close dismisses without focus restore. Listeners attach while open and detach on close and unmount. Escape and the × close restore focus to the trigger (the × is removed with the panel); an outside pointerdown leaves focus where the user clicked. A second press of the trigger keeps focus on the trigger.

**Panel geometry.** Width adapts to content (240–480px; long opprof names ellipsize at the cap). The list scrolls under a 260px cap with the teleported-menu scrollbar: it stays out of standard-scrollbar mode (`scrollbar-width/color: auto`, so Chromium keeps honouring the `::-webkit-scrollbar-*` block) and paints that block — `#5a5a5a` thumb on a transparent track, no step buttons — because the popover lives on `body`, outside the `.pr-root` rules (issue #266). The panel teleports to `body` and anchors `fixed` under the trigger (right-aligned, clamped into the viewport) at z-index 1000.

## Acceptance Criteria

1. **PR-BASELINE-001** — Trigger renders only when `pickBaselineFile` is provided.
2. **PR-BASELINE-002** — Click opens the checkbox view: 基线 / **Baseline** title, rows, 添加报告文件 + 基线对比 (no 添加基线 / Add baseline); the checkbox is a 16px square with a white checkmark.
3. **PR-BASELINE-003** — Rows render checkbox + name + dimmed path; the checked state is the host-owned `baselines` list.
4. **PR-BASELINE-006** — Add report file calls `pickBaselineFile`; a null result emits nothing.
5. **PR-BASELINE-008** — Dismiss via ×, second press, outside pointerdown, Escape.
6. **PR-BASELINE-008b** — Escape and × restore focus to the trigger; outside pointerdown does not.
7. **PR-BASELINE-009** — Labels come from i18n; trigger carries `aria-expanded` and `--on` when open.
8. **PR-BASELINE-010** — Trigger renders with the shared `pr-toolbar__icon-btn` / `pr-icon-tip` chrome (owned by PR-TOOLBAR-009c).
9. **PR-BASELINE-011** — The mockup-extracted add-baseline glyph renders as the trigger mask.
10. **PR-BASELINE-023** — Checking appends to `baselines` immediately; unchecking removes it; the set survives closing (host-owned, no local state).
11. **PR-BASELINE-024** — Checked entries missing from `recentBaselines` render as extra rows and uncheck out normally.
12. **PR-BASELINE-025** — Add report file appends the pick as a checked entry immediately; an already-checked path is not re-added.
13. **PR-BASELINE-026** — Without `recentBaselines` the view shows the empty copy; 添加报告文件 still works and Compare stays disabled.
14. **PR-BASELINE-027** — The panel teleports to `body` and anchors `fixed` under the trigger (right-aligned, clamped into the viewport) at z-index 1000; width adapts to content (240–480px).
15. **PR-BASELINE-028** — The component exposes `close()` via `defineExpose`; a no-op when closed.
16. **PR-BASELINE-029** — Rows title through `baselineDisplayTitle` (filename + timestamp instead of a generated id).
17. **PR-BASELINE-030** — Add report file gives the entry `pickedAt` (the pick's mtime, else the pick moment).
18. **PR-BASELINE-031** — The scrolling list stays out of standard-scrollbar mode and paints the teleported-menu scrollbar through `::-webkit-scrollbar-*` (issue #266).
19. **PR-BASELINE-032** — 基线对比 emits `compare-baselines` with the checked set and closes the popover; disabled with nothing checked.
20. **PR-BASELINE-034** — While comparing, 取消对比 replaces 基线对比 in the same right-hand slot; clicking emits `cancel-comparison`, keeps the popover open and the checked set untouched.
21. **PR-BASELINE-035** — Checking a path already on the host list reuses the committed entry (no id/operators/pickedAt replacement).
22. **PR-BASELINE-036** — Browsing a path already listed in `recentBaselines` checks that row and reuses its id/operators instead of minting a fresh id.

## Edge Cases

| Case | Behavior |
|------|----------|
| `pickBaselineFile` absent | Trigger and popover absent |
| `pickBaselineFile` rejects | Treated as cancel — no emit, popover stays open |
| Dialog cancelled (`null`) | No emit, popover stays open |
| Nothing checked | Compare baselines disabled; Add report file still works |
| Checked set with no comparison rows | Plain aside (no bar, no deltas) until Compare baselines |
| Already comparing | Compare is replaced by Cancel comparison; Add report file stays |
| Unchecking the selected baseline | The root prunes its comparison rows immediately (host-owned invariant) |
| No `recentBaselines` | Empty-state copy; the footer still renders |

## Dependencies

- [ProfilingReport.spec.md](../../ProfilingReport/ProfilingReport.spec.md) — owns the checked set and the comparison rows; Compare starts the comparison, Cancel clears the rows.
- [ReportToolbar.spec.md](../ReportToolbar.spec.md) — hosts the trigger and forwards the compare / cancel emits.
- Popover dismiss contract mirrors 显示控制 ([PR-TOOLBAR-010](../ReportToolbar.spec.md)).

## Open

- Comparison rendering (showing the baseline's swimlane/deltas against the current report) is host / later-slice work; this component only maintains the list and comparison-intent contract.

## Changelog
- **2026-11-27** — PR #273 requirements rework: checkboxes apply immediately (host-owned list); 添加基线 / **Add baseline** and the staged draft removed; 基线对比 / **Compare baselines** starts the comparison and closes the popover; while comparing the same slot is 取消对比 / **Cancel comparison**; checkbox rendered as the design square + white checkmark (PR-BASELINE-002/023..027/032/034/035 restated; PR-BASELINE-033 withdrawn).
- **2026-11-27** — 1130 popup first pass: staged checkbox draft, Add baseline, Compare baselines, Cancel comparison, 当前 / Current row, self-compare rule (superseded by the requirements rework above).
- **2026-11-26** — Issue #266: the checkbox list now carries the teleported-menu scrollbar through the `::-webkit-scrollbar-*` block (`scrollbar-width/color: auto` keeps Chromium in that mode — a non-auto value drops it and paints the native bar with step buttons) instead of the native light bar over the dark popover (PR-BASELINE-031).
- **2026-11-25** — Product bug: the overview sample↔cursor connection stems painted over the open picker. The panel now **teleports to `body`**, anchors `fixed` under the trigger and sits at **z-index 1000**; the outside-dismiss checks the trigger wrap and the teleported panel (PR-BASELINE-027 restated).
- **2026-11-16** — Review PR #234: the popup title is 选择基线 / Select baselines; rows title through `baselineDisplayTitle`; Browse tags entries with `pickedAt`; the component exposes `close()` (PR-BASELINE-028..030).
- **2026-11-12** — ТЗ rework: a single checkbox view replaces the two-view design — the checked set IS the host-owned baseline list (`update:baselines` on every toggle/Browse), no saved-list view, radios, −, Add Selected or other actions (PR-BASELINE-023..027; old 003..005, 007, 012..022 withdrawn).
- **2026-11-11** — Second view (Add Recent) with checkboxes + Add Selected / Browse, footer actions on the list view (Set current as Baseline / Add Recent / Clear all / Deselect / Browse), per-view titles, content-adaptive panel width (PR-BASELINE-014..022).
- **2026-11-11** — Selection radio per row (PR-BASELINE-013).
- **2026-11-12** — ТЗ rework (PR-BASELINE-012 withdrawn): row actions are gone — the single checkbox view is the whole picker; toggles emit `update:baselines`, Browse appends, nothing else.
- **2026-11-11** — Trigger glyph replaced with the mockup-extracted add-baseline icon (PR-BASELINE-011 restated).
- **2026-11-10** — Review pass 2: panel bg uses the `--pr-surface-raised` token; popover closes when the hook gate is removed; PR-BASELINE-010 asserts the rendered chrome classes (owned by PR-TOOLBAR-009c).
- **2026-11-10** — Review pass: action-icon chrome moved to `tokens.css`; trigger binds fallthrough attrs; listeners detach on unmount; Escape/× restore focus; hook call in try/catch; PR-BASELINE-008b/011.
- **2026-11-10** — Trigger gets its own action-icon button styles (PR-BASELINE-010).
- **2026-11-10** — Initial spec.
