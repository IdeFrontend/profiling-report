# SourceView

| spec-id-prefix |
|----------------|
| PR-SOURCE-*    |

Dual-pane Source | SASS correlation surface for the 源码 tab (UI-37). Left pane: Sudu editor + metrics. Right pane: plain table (`#` · Address · Assembly · metrics — no Sudu). Mock-first when embeds are absent.

## Inputs

**model** (`SourceCorrelationModel`) drives both panes, file select, navigate-by options, and correlation maps. Optional **locale** and **suduWorkerUrl** (default `/sudu/worker.js`).

## Behavior

**Layout.** Chrome matches [`v930-source/source-correlation`](../../../docs/ui/source/v930-source/source-correlation.jpeg): **first control bar** (Left/Right View, Search, action icons) sits on the **same row as the secondary tabs** via Teleport into ReportToolbar’s `source-chrome-host` (no extra margin/padding on that bar). Icons: prev/next line (thin chevrons; always enabled), scroll-to-top / scroll-to-bottom, **two** navigate-sort buttons (asc + desc), help. No dim-zeros toggle, no Source shortcuts popover, no Redo Resolve, and **no** bottom dock (Inline Functions / Source Markers / Statistics). Pane **Link views** uses interlocking chain links (**one shared on/off** for both panes). Per-pane bar: Source select, link-sync, Navigate By. While Link views is on, choosing a Navigate By metric that the other pane’s dropdown also lists selects that metric there too; a metric the other dropdown does not list leaves that pane’s selection unchanged. With Link views off, each pane keeps its own Navigate By. Dual panes below: Source | SASS. **Source** is Sudu + metrics. **SASS** is table-only — `#`, Address, Assembly, Instructions Executed, Sampling Stall, Warp Occupancy (capsule: hatch background, solid used fill, `%` at the right end). Metrics / SASS column headers are **user-resizable** (drag the column edge; Source metrics header stays aligned with the body).

**Selected pane.** Exactly one of the two panes is selected at all times (Source by default). Clicking a pane (or a line inside it) selects it; clicks outside the panes (toolbar, search, aside) do **not** change selection. The selected pane uses the accent blue border (`#3078F0` / sketch `#317FFF`). The unselected pane has no blue border.

**Correlation.** Selecting a source line highlights mapped asm rows and moves the asm caret to the first mapped instruction when Link views is on; selecting an asm line jumps back via `asmToSource` and highlights the full mapped asm sibling set. Programmatic Sudu caret echoes from an asm-driven `setLine` must not re-drive the asm pane (would snap to `mapped[0]`). Sudu notifies the caret listener only when the line changes: a same-line `setLine` reports `unchanged` and clears the echo gate, and a metrics click on the line the caret already occupies still selects that line. An imperative `setLine` queued before the editor boots still echoes when boot applies it (so the gate can clear). A line applied from the `currentLine` prop at boot (scroll-to-top / scroll-to-bottom) does not echo. Switching files replaces the Sudu model without treating `setModel`'s line-1 caret notification as a selection. Both Link views buttons toggle the same state.

**Dropdowns.** Left View, Right View, each pane’s Source file, and each pane’s Navigate By open even when the list has a single item (they are never disabled). The closed control stays the shared pill. The open menu matches the card-metric (Utilization) popup: dark surface, accent-blue selected row.

**Pane bars.** Each pane bar is Source, the link button, then Navigate By, on one line while both bars fit. When either bar cannot fit that row, both bars switch to two lines together (Navigate By on the second line) so the column headers stay aligned.

**Navigate / search.** Search is the timeline toolbar search (fixed width). Showing the clear × does not change that width. Empty search is a no-op for Enter. Both panes **paint** matches at once: Sudu `highlightRanges` on Source text (case-insensitive; metrics table cells are **not** highlighted) and Assembly-column CLA chips on SASS (`pr-field-match` / [UI-43](../../../docs/context/decisions/UI.md)). Enter finds the next hit in the **selected pane** only (Source → `selectNextRange` / wrap; SASS → Assembly match walk). **Prev/next line** buttons (`source-find-prev` / `source-find-next`) are always enabled and do **not** use the search query — each click selects the previous / next line in the **selected pane** only and wraps. With no caret, next starts at the first line and prev at the last. Tooltips describe that. **Sort navigate** buttons (asc/desc) are click actions, not a sticky selected mode — neither stays visually pressed. Each click steps the selected pane through its Navigate By hot lines (non-zero metric), lowest-first or highest-first, and wraps. Tooltips describe the direction. The other pane’s Navigate By is not used. Scroll-to-top / scroll-to-bottom reset both panes to the first / last line and suppress cross-pane correlation highlights until the next caret selection. Metric cells stay uncolored (sketch has no heat tint — [UI-59](../../../docs/context/questions/UI.md)).

**Sudu runtime.** The worker pool is process-lifetime cached (`suduRuntime`); panes dispose only editors/models on unmount. Until the editor reports usable geometry, the left pane shows a centered loading indicator and does not reveal the editor or its metrics columns. Those appear together once initialization finishes. The editor theme sets `editorFont` to 12px **`monospace`** with no fallback stack and no font assets (Sudu’s default 16px Consolas is too large for the sketch). Metrics tables use the editor’s `getFontFamily()` / `getFontSize()` so glyphs match the canvas (standalone-sample pattern). Editor ↔ metrics-table scroll sync follows `editorAndTable.js` (device-px vscroll ↔ CSS table scroll; row click = `setPosition` + `focus`; caret listener drives selection). **No custom canvas line overlays** — Sudu paints the current line. The metrics table also marks the current source line. Editor ↔ metrics scroll stays on regardless of the Source↔SASS link toggles. A right-click on the editor does not open Sudu’s native menu. A DOM menu with one **Copy** action copies the selected text. A caret with no range does not write the clipboard.

## Acceptance Criteria

1. **PR-SOURCE-001** — Renders `data-testid="source-view"` with dual panes and **no** dock shell.
2. **PR-SOURCE-002** — Mock model shows `source-mock-badge`.
3. **PR-SOURCE-003** — Source row click updates correlated asm highlight set.
4. **PR-SOURCE-004** — Hovering a sampling-stall metric cell shows `stall-tooltip`.
5. **PR-SOURCE-005** — Asm row click keeps the chosen asm current line, moves the Sudu caret with `setPosition` + `revealLine` + `focus` (Sudu only paints the caret while focused — no custom canvas overlay), marks the mapped source metrics row, and highlights the full mapped asm sibling set (no snap to first mapped insn).
6. **PR-SOURCE-006** — Selecting an unmapped source line clears asm current/correlated highlights. Unmapped asm row clears source metrics current row and Sudu current-line paint (`clearLine` / theme override; Sudu has no clearSelection API).
7. **PR-SOURCE-007** — Toolbar exposes search, action icons (incl. scroll-to-top/bottom), and shared link toggles (`source-search`, `source-toolbar-actions`, `source-scroll-top`, `source-scroll-bottom`, `source-link-source`, `source-link-asm`). Does **not** expose dim-zeros, Source shortcuts, or Redo Resolve.
8. **PR-SOURCE-008** — Search paints both panes at once: Sudu `highlightRanges` on Source (metrics table unmarked) and Assembly chips on SASS (`source-asm-match` / `pr-field-match`); Address-only needles do not match Assembly. Enter steps the **selected** pane only (`selectNextRange` / wrap on Source). Prev/next line buttons are always enabled and step the selected pane’s lines (independent of search); with no caret, next starts at first and prev at last.
9. **PR-SOURCE-009** — Turning off either Link views toggle (shared state) keeps source selection from moving the asm caret; both buttons stay in sync.
10. **PR-SOURCE-010** — Bottom dock (Inline Functions / Source Markers / Statistics) is **not** rendered.
11. **PR-SOURCE-011** — Asm Navigate By stays enabled. With Link views on, a metric listed in both dropdowns is selected in both panes.
12. **PR-SOURCE-012** — Scroll-to-top clears correlated row highlights while both carets sit at line 1; a later row click restores correlation. Scroll-to-bottom likewise suppresses correlation at the last lines.
13. **PR-SOURCE-013** — SASS pane renders `asm-table-pane` (no Sudu) with column order `#`, Address, Assembly, Instructions Executed, Sampling Stall, Warp Occupancy.
14. **PR-SOURCE-014** — After an asm row click, Sudu caret echoes for the mapped source line do not snap the asm current row to `mapped[0]` or steal pane selection (no timer gate — absorb + same-group stay).
15. **PR-SOURCE-015** — Switching the Source file select clears source/asm current rows and correlated highlights (no stale mapping from the previous file). The shared search query is kept.
16. **PR-SOURCE-016** — Scroll-to-bottom moves both carets to the last lines and suppresses correlated highlights until the next selection.
17. **PR-SOURCE-017** — Metrics / SASS column headers expose resize handles on every column except the last (`source-col-resize`); dragging trades width with the next column so only that divider moves.
18. **PR-SOURCE-018** — Exactly one pane is selected (`source-pane-source` / `source-pane-asm`); Source is default; pane click switches; clicks outside panes keep the selection; selected pane has accent border class `pr-source-view__pane--selected`; unselected pane border is transparent (no muted blue frame).
19. **PR-SOURCE-019** — Every Source dropdown opens with one item; menu is the Utilization-style popup; closed control stays the pill.
20. **PR-SOURCE-020** — Source search is the timeline search; clear × does not change its width; Enter finds the next hit (Sudu `selectNextRange` when Source is selected; Assembly match walk when SASS is selected).
21. **PR-SOURCE-021** — Right-click on the Sudu editor suppresses the native menu and shows a DOM menu with a single Copy action. Copy writes the selected text. A caret with no range does not write the clipboard.
22. **PR-SOURCE-022** — Pane bars share one wrap. When either pane’s Source + link + Navigate By does not fit, both bars put Navigate By on the second line. When both fit, both stay on one line.
23. **PR-SOURCE-023** — While the Sudu editor is initializing, the left pane shows a centered loading indicator (`sudu-loading`) and hides the editor and metrics columns. When geometry is ready, the editor and the metrics table appear together.
24. **PR-SOURCE-024** — Asc/desc buttons step the selected pane through its Navigate By hot lines (increasing or decreasing metric, ties by line number, wrap). Neither button keeps `pr-source-view__icon-btn--on` / `aria-pressed`. Distinct `sourceSortAsc` / `sourceSortDesc` labels. The other pane’s Navigate By is not used.
25. **PR-SOURCE-025** — Link views off keeps the other pane’s Navigate By. A metric missing from the other dropdown is not applied there.

## Design sketches

- [`visual/source-correlation.png`](./visual/source-correlation.png) ← [`v930-source/source-correlation`](../../../docs/ui/source/v930-source/source-correlation.jpeg)

## Changelog

- **2026-10-23** — Editor caret moves and Enter-find restore the current-line band after `clearLine`. An asm hit in another file waits for the model swap instead of `setLine` on the old document (`PR-SOURCE-005`/`006`).
- **2026-10-23** — Scroll and file change drop a pre-boot asm echo gate. `clearLine`'s hidden current-line theme is restored on metrics click and scroll. Boot replays the caret into the metrics table once geometry is usable (`PR-SOURCE-006`/`012`/`016`).
- **2026-10-23** — File switch ignores Sudu `setModel`'s line-1 caret notification. Scroll during boot does not echo as a selection; an asm `setLine` queued before boot still does (`PR-SOURCE-012`/`015`/`016`).
- **2026-10-23** — Same-line asm `setLine` clears the echo gate; a metrics click on the caret's current line still selects (`PR-SOURCE-003`/`006`/`014`).
- **2026-10-23** — Search highlights paint in both panes; Enter still steps the selected pane (`PR-SOURCE-008`).
- **2026-10-23** — Source search uses Sudu `highlightRanges` / `selectNextRange` (`PR-SOURCE-008`/`020`; `@sudu-ide/code-review` 0.0.133-ascendc).
- **2026-10-22** — Prev/next line buttons step the selected pane (always enabled; independent of search) (`PR-SOURCE-008`).
- **2026-10-21** — Link views mirrors Navigate By when both panes list the metric (`PR-SOURCE-011`/`025`).
- **2026-10-21** — Copy includes a last-line `selectLine` range (`lineCount`, 0). Wrapped pane bars use one 8px row gap (`PR-SOURCE-021`/`022`).
- **2026-10-21** — Asc/desc buttons step through the selected pane’s Navigate By hot lines (`PR-SOURCE-024`).
- **2026-10-21** — Left pane keeps the editor and metrics columns hidden behind a centered loading indicator until Sudu geometry is ready (`PR-SOURCE-023`).
- **2026-10-21** — Pane bars wrap together: if either Source toolbar needs two lines, both put Navigate By on the second line (`PR-SOURCE-022`).
- **2026-10-21** — Drop the Sudu current-line band. Right-click shows a DOM Copy menu instead of Sudu’s native menu (`PR-SOURCE-005`/`021`).
- **2026-10-21** — Selected pane keeps the only blue border. Dropdowns open with one item; popup matches the Utilization menu. Source search reuses the timeline search so the clear × does not change width (`PR-SOURCE-018`/`019`/`020`).
- **2026-10-21** — Drop syncOrigin / ignoreCaret timers; absorb echo + same-group stay (`PR-SOURCE-014`).
- **2026-10-21** — Align editor↔table sync with code-review `editorAndTable` sample; drop custom Sudu line overlays (`PR-SOURCE-005`).
- **2026-10-20** — Selected pane + scoped search: Source editor TODO / SASS Assembly chips (`PR-SOURCE-008`/`018`).
- **2026-10-20** — Column resize trades with the next column so only the dragged divider moves (`PR-SOURCE-017`).
- **2026-10-20** — Replace JetBrains Mono with bare `monospace`; drop all bundled font assets, including codicon.
- **2026-10-20** — Remove dim-zeros, Source shortcuts, Redo Resolve, and bottom dock (`PR-SOURCE-001`/`007`/`010`).
- **2026-10-19** — Resizable Source / SASS metrics columns (`PR-SOURCE-017`).
- **2026-10-19** — Rework mislabeled CSV download → scroll-to-bottom; share Link views state across panes; keep asm caret + sibling highlights when sync starts from SASS (`PR-SOURCE-005`/`009`/`012`/`016`).
- **2026-10-14** — File switch clears caret + correlation (`PR-SOURCE-015`).
- **2026-10-14** — Find next/prev no-op when search empty; sort buttons jump to first Navigate By hot line.
- **2026-10-12** — Align Source chrome with v930 sketch: tab-row first bar (Teleport), dual sort buttons, icon glyphs, Warp Occupancy capsule bars.
- **2026-10-12** — Fix asm→source sync bounce: ignore Sudu caret echo / `syncOrigin` gate (`PR-SOURCE-014`).
- **2026-10-09** — SASS right pane is table-only (`#` · Address · Assembly · metrics); no Sudu (`PR-SOURCE-013`).
- **2026-10-09** — PR review: JetBrains Mono under its real name (+ `fonts.load`); untie editor↔table scroll from link toggles; scroll-to-top suppresses stale correlation (`PR-SOURCE-012`).
- **2026-10-09** — Source chrome `<select>`s use shared `.pr-block-pill` (tokens.css) so they match CSV / PIPE block dropdowns.
- **2026-10-08** — Sketch color/font pass: grey Warp Occupancy bars, white dock underline, `#1F1F1F`/`#2A2A2A`/`#1E1E1E` plane, UI sans + mono metrics, playhead accent `#3078F0`.
- **2026-10-08** — Removed non-sketch metric heat tint ([UI-59](../../../docs/context/questions/UI.md)).
- **2026-10-08** — Dock bodies, per-pane Navigate By, metrics CSV download; open questions DATA-52/53, UI-56–59 (`PR-SOURCE-010`–`011`).
- **2026-10-07** — Sketch top-bar chrome: Search, action icons, link sync, Redo Resolve (`PR-SOURCE-007`–`009`).
- **2026-10-07** — Initial Source tab surface (mock-first).
