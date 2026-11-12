# BaselinePicker

| spec-id-prefix |
|----------------|
| PR-BASELINE-*  |

Baseline (对比基线) picker: a toolbar popover with a single checkbox view of the app's reports. The checked set IS the host-owned baseline list — the picker only toggles it and hands every change up; nothing else (no saved-list view, no per-row actions beyond the checkbox).

Sketch gap: no design frame covers this surface yet; chrome follows the toolbar popover family (显示控制 panel tokens, action-icon trigger).

## Inputs

**baselines** (`Baseline[]` — `{ id, name, path, operators? }`) is the host-owned checked set — the popover's checkbox state derives from it and never keeps a private copy. **recentBaselines** (`Baseline[]`) is the host's own report list (MSTT: the Performance results tree; bundled web hosts: the demo list) — one checkbox row per entry; entries of `baselines` missing from it render as extra checked rows. **pickBaselineFile** (`() => Promise<BaselinePick | null>`) is the optional host hook for Browse; absent, the trigger is not rendered (the library never reads the filesystem — same contract as `resolveSourceFile`). **locale** localizes all copy.

## Outputs

Every checkbox change emits **update:baselines** with the new checked set — the host owns persistence (session-only in the bundled web hosts; a real host persists). Browse emits the same with the picked report appended as a checked entry (new id, name falls back to the path basename; an already-checked path changes nothing). The picker emits nothing else.

## Behavior

**Trigger.** A square action-icon button (`data-testid="toggle-baselines"`) with the mockup's **add-baseline** glyph (extracted from `docs/ui/source/1130/add-baseline.jpeg` — the highlighted toolbar action of the 增加基线操作 scene; provenance crop `docs/ui/review/icons/add-baseline-1130.png`), rendered only when `pickBaselineFile` is provided. It opens the popover and reflects the open state through `aria-expanded` and the `--on` class (shared action-icon states, now in the global `tokens.css`). Fallthrough attrs (the toolbar's `data-toolbar-clip`) bind to the trigger button, so the clip-inert scan and the right-aligned tooltip rule see the button, not the wrapper.

**Popover.** Anchored under the trigger, right-aligned, same panel tokens as 显示控制; width adapts to its content (240–480px) so full opprof run names fit. Header carries the title (添加基线 / Add baselines) and a CloseButton (×). Body is the checkbox list; the footer is a single **Browse** button. No OK/Cancel: a toggle applies immediately, and every dismiss path simply closes the popover — the checked set survives closing (host-owned).

**List rows.** One row per report: a checkbox (the whole row is its label; the native input is sr-clipped, a 12px square dot paints the state), **name** as the primary line, **path** as a secondary dimmed line. A checked row shows the filled accent dot; the checked state comes from `baselines` — nothing else selects or highlights rows. Secondary text (the path, the empty copy) and the Browse action clear WCAG AA (4.5:1) on both the panel and the row-hover tint — the path is how same-named runs are told apart.

**Toggling.** Checking a row emits `update:baselines` with it appended; unchecking emits the list without it. Closing and reopening the popover keeps whatever is checked (the component holds no local state).

**Browse.** The footer button (`data-testid="baseline-browse"`) calls `pickBaselineFile()`. A `null` result or a rejected hook changes nothing. A pick appends `{ id, name, path }` (fresh id; name falls back to the path basename) to the checked set via `update:baselines` — the new row renders as a checked extra row. Re-picking an already-checked path emits nothing.

**Empty state.** With no `recentBaselines` and nothing checked, the body shows dim copy (暂无最近的报告 / No recent reports); Browse stays available.

**Dismiss.** The popover closes via the header ×, a second press of the trigger, a pointerdown outside the wrap (trigger + panel), or Escape — the same dismiss contract as 显示控制 and 快捷键说明. Listeners attach while open and detach on close and unmount. Escape and the × close restore focus to the trigger (the × is removed with the panel); an outside pointerdown leaves focus where the user clicked. A second press of the trigger keeps focus on the trigger.

## Acceptance Criteria

1. **PR-BASELINE-001** — Trigger renders only when `pickBaselineFile` is provided.
2. **PR-BASELINE-002** — Click opens the checkbox view: title, rows, Browse — and nothing else (no radios, no other footer actions).
3. **PR-BASELINE-003** — Rows render checkbox + name + dimmed path; the checked state is the host-owned `baselines` list.
4. **PR-BASELINE-023** — Checking a row emits `update:baselines` with it appended; unchecking removes it; the checked set survives closing (no local reset).
5. **PR-BASELINE-024** — Checked entries missing from `recentBaselines` render as extra checked rows and uncheck out normally.
6. **PR-BASELINE-025** — Browse appends the pick as a checked entry via `update:baselines`; an already-checked path emits nothing.
7. **PR-BASELINE-006** — Browse calls `pickBaselineFile`; a null result emits nothing.
8. **PR-BASELINE-008** — Dismiss via ×, second press, outside pointerdown, Escape.
9. **PR-BASELINE-008b** — Escape and × restore focus to the trigger; outside pointerdown does not.
10. **PR-BASELINE-009** — Labels come from i18n; trigger carries `aria-expanded` and `--on` when open.
11. **PR-BASELINE-010** — Trigger renders with the shared `pr-toolbar__icon-btn` / `pr-icon-tip` chrome (the block lives in `tokens.css`, owned by PR-TOOLBAR-009c).
12. **PR-BASELINE-011** — The mockup-extracted add-baseline glyph (`icons/add-baseline.png`) renders as the trigger mask.
13. **PR-BASELINE-026** — Without `recentBaselines` the view shows the empty copy; Browse still works.
14. **PR-BASELINE-027** — The panel adapts its width to the content (240–480px).

## Edge Cases

| Case | Behavior |
|------|----------|
| `pickBaselineFile` absent | Trigger and popover absent |
| `pickBaselineFile` rejects | Treated as cancel — no emit, popover stays open |
| Dialog cancelled (`null`) | No emit, popover stays open |
| No `recentBaselines`, nothing checked | Empty-state copy; Browse available |
| Unchecking the selected baseline | The parent clears the selection (its invariant, not the picker's) |

## Dependencies

- [ProfilingReport.spec.md](../../ProfilingReport/ProfilingReport.spec.md) — owns the list, appends and selects on `add-baseline`.
- [ReportToolbar.spec.md](../ReportToolbar.spec.md) — hosts the trigger in the timeline action list.
- Popover dismiss contract mirrors 显示控制 ([PR-TOOLBAR-010](../ReportToolbar.spec.md)).

## Open

- Comparison rendering (showing the baseline's swimlane/deltas against the current report) is host / later-slice work; this component only maintains the list contract.
- Sketch gap: tokens are provisional until a design frame lands; popover chrome follows the [floating-chrome canon](../../../../docs/ui/INTERACTIONS.md).
- The **icon** is Product-confirmed (UI-61): the mockup's add-baseline glyph from the 1130 batch. The **popover chrome** (layout/placement) is still not Product-confirmed; see [UI-61](../../../../docs/context/questions/UI.md).

## Changelog
- **2026-11-12** — Review fixes: secondary text and Browse clear WCAG AA on the panel and its hover tint.
- **2026-11-12** — ТЗ rework: a single checkbox view replaces the two-view design — the checked set IS the host-owned baseline list (`update:baselines` on every toggle/Browse), no saved-list view, radios, −, Add Selected or other actions (PR-BASELINE-023..027; old 003..005, 007, 012..022 withdrawn).
- **2026-11-11** — Second view (Add Recent) with the host's recent reports as checkboxes + Add Selected / Browse, footer actions on the list view (Set current as Baseline / Add Recent / Clear all / Deselect / Browse), per-view titles, and a content-adaptive panel width (PR-BASELINE-014..022).
- **2026-11-11** — Selection radio per row (PR-BASELINE-013): real radio inputs in one native group on each row's left; checked = current baseline, none by default; clicking one selects exactly like the row click.
- **2026-11-11** — Per-row − remove button (PR-BASELINE-012): emits `remove-baseline`, never selects, popover stays open.
- **2026-11-11** — Trigger glyph replaced with the mockup-extracted add-baseline icon (1130 batch; replaces the flag; PR-BASELINE-011 restated).
- **2026-11-10** — Review pass 2: panel bg uses the `--pr-surface-raised` token; popover closes when the hook gate is removed at runtime (root is `v-if`-gated, component survives); PR-BASELINE-010 asserts the rendered chrome classes (the tokens.css block is owned by PR-TOOLBAR-009c).
- **2026-11-10** — Review pass: action-icon chrome moved to the shared `tokens.css` (PR-BASELINE-010 restated); trigger binds fallthrough attrs (`data-toolbar-clip`); root not rendered without the hook (no dead flex gap); listeners detach on unmount; Escape/× restore focus (PR-BASELINE-008b); hand-drawn glyph replaced with the HDesign 时间轴打点 export (PR-BASELINE-011); hook call is the only thing inside the add try/catch.
- **2026-11-10** — Trigger gets its own copy of the toolbar action-icon button styles (parent scoped CSS does not cross the component boundary; PR-BASELINE-010).
- **2026-11-10** — Initial spec.
