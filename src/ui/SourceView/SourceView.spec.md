# SourceView

| spec-id-prefix |
|----------------|
| PR-SOURCE-*    |

Dual-pane Source | SASS correlation surface for the 源码 tab (UI-37). Left pane: Sudu editor + metrics. Right pane: plain table (`#` · Address · Assembly · metrics — no Sudu). Mock-first when embeds are absent.

## Inputs

**model** (`SourceCorrelationModel`) drives both panes, file select, navigate-by options, and correlation maps. Optional **locale** and **suduWorkerUrl** (default `/sudu/worker.js`).

## Behavior

**Layout.** Chrome matches [`v930-source/source-correlation`](../../../docs/ui/source/v930-source/source-correlation.jpeg): **first control bar** (Left/Right View, Search, action icons) sits on the **same row as the secondary tabs** via Teleport into ReportToolbar’s `source-chrome-host` (no extra margin/padding on that bar). Icons: find next/prev (thin chevrons), scroll-to-top / scroll-to-bottom, **two** navigate-sort buttons (asc + desc), help. No dim-zeros toggle, no Source shortcuts popover, no Redo Resolve, and **no** bottom dock (Inline Functions / Source Markers / Statistics). Pane **Link views** uses interlocking chain links (**one shared on/off** for both panes). Per-pane bar: Source select, link-sync, **independent** Navigate By. Dual panes below: Source | SASS. **Source** is Sudu + metrics. **SASS** is table-only — `#`, Address, Assembly, Instructions Executed, Sampling Stall, Warp Occupancy (capsule: hatch background, solid used fill, `%` at the right end). Metrics / SASS column headers are **user-resizable** (drag the column edge; Source metrics header stays aligned with the body).

**Selected pane.** Exactly one of the two panes is selected at all times (Source by default). Clicking a pane (or a line inside it) selects it; clicks outside the panes (toolbar, search, aside) do **not** change selection. The selected pane uses the accent blue border (`#3078F0` / sketch `#317FFF`); the other keeps the muted frame (`#2e4a7a`).

**Correlation.** Selecting a source line highlights mapped asm rows and moves the asm caret to the first mapped instruction when Link views is on; selecting an asm line jumps back via `asmToSource` and highlights the full mapped asm sibling set. Programmatic Sudu caret echoes from an asm-driven `setLine` must not re-drive the asm pane (would snap to `mapped[0]`). Both Link views buttons toggle the same state.

**Navigate / search.** Search targets the **selected pane** only. Empty search is a no-op (find buttons disabled). **Source selected:** search runs in the Sudu editor (API not wired yet — TODO; metrics table is **not** highlighted). **SASS selected:** search runs in the **Assembly** column only; matching substrings use the Compute Load Analysis chip (`pr-field-match` / [UI-43](../../../docs/context/decisions/UI.md)); find next/prev walks those hits. **Sort navigate order** (asc/desc) jumps to the first Navigate By hot line for the selected pane. Scroll-to-top / scroll-to-bottom reset both panes to the first / last line and suppress cross-pane correlation highlights until the next caret selection. Metric cells stay uncolored (sketch has no heat tint — [UI-59](../../../docs/context/questions/UI.md)).

**Sudu runtime.** The worker pool is process-lifetime cached (`suduRuntime`); panes dispose only editors/models on unmount. The editor theme sets `editorFont` to 12px **`monospace`** with no fallback stack and no font assets (Sudu’s default 16px Consolas is too large for the sketch). Metrics tables use the editor’s `getFontFamily()` / `getFontSize()` so glyphs match the canvas (standalone-sample pattern). Editor ↔ metrics-table scroll sync follows `editorAndTable.js` (device-px vscroll ↔ CSS table scroll; row click = `setPosition` + `focus`; caret listener drives selection). **No custom canvas line overlays** — Sudu paints the current line. Editor ↔ metrics scroll stays on regardless of the Source↔SASS link toggles.

## Acceptance Criteria

1. **PR-SOURCE-001** — Renders `data-testid="source-view"` with dual panes and **no** dock shell.
2. **PR-SOURCE-002** — Mock model shows `source-mock-badge`.
3. **PR-SOURCE-003** — Source row click updates correlated asm highlight set.
4. **PR-SOURCE-004** — Hovering a sampling-stall metric cell shows `stall-tooltip`.
5. **PR-SOURCE-005** — Asm row click keeps the chosen asm current line, moves the Sudu caret with `setPosition` + `revealLine` + `focus` (Sudu only paints the caret while focused — no custom canvas overlay), marks the mapped source metrics row, and highlights the full mapped asm sibling set (no snap to first mapped insn).
6. **PR-SOURCE-006** — Selecting an unmapped source line clears asm current/correlated highlights. Unmapped asm row clears source metrics current row and Sudu current-line paint (`clearLine` / theme override; Sudu has no clearSelection API).
7. **PR-SOURCE-007** — Toolbar exposes search, action icons (incl. scroll-to-top/bottom), and shared link toggles (`source-search`, `source-toolbar-actions`, `source-scroll-top`, `source-scroll-bottom`, `source-link-source`, `source-link-asm`). Does **not** expose dim-zeros, Source shortcuts, or Redo Resolve.
8. **PR-SOURCE-008** — Source-selected search does not mark metrics tables (editor find TODO). SASS-selected search highlights Assembly substrings (`source-asm-match` / `pr-field-match`) and find next/prev walks those hits; Address-only needles do not match. Sort asc/desc jumps to the first Navigate By hot line for the selected pane.
9. **PR-SOURCE-009** — Turning off either Link views toggle (shared state) keeps source selection from moving the asm caret; both buttons stay in sync.
10. **PR-SOURCE-010** — Bottom dock (Inline Functions / Source Markers / Statistics) is **not** rendered.
11. **PR-SOURCE-011** — Asm Navigate By select is enabled and independent of the source pane’s Navigate By.
12. **PR-SOURCE-012** — Scroll-to-top clears correlated row highlights while both carets sit at line 1; a later row click restores correlation. Scroll-to-bottom likewise suppresses correlation at the last lines.
13. **PR-SOURCE-013** — SASS pane renders `asm-table-pane` (no Sudu) with column order `#`, Address, Assembly, Instructions Executed, Sampling Stall, Warp Occupancy.
14. **PR-SOURCE-014** — After an asm row click, Sudu caret echoes for the mapped source line do not snap the asm current row to `mapped[0]` or steal pane selection (no timer gate — absorb + same-group stay).
15. **PR-SOURCE-015** — Switching the Source file select clears source/asm current rows and correlated highlights (no stale mapping from the previous file).
16. **PR-SOURCE-016** — Scroll-to-bottom moves both carets to the last lines and suppresses correlated highlights until the next selection.
17. **PR-SOURCE-017** — Metrics / SASS column headers expose resize handles on every column except the last (`source-col-resize`); dragging trades width with the next column so only that divider moves.
18. **PR-SOURCE-018** — Exactly one pane is selected (`source-pane-source` / `source-pane-asm`); Source is default; pane click switches; clicks outside panes keep the selection; selected pane has accent border class `pr-source-view__pane--selected`.

## Design sketches

- [`visual/source-correlation.png`](./visual/source-correlation.png) ← [`v930-source/source-correlation`](../../../docs/ui/source/v930-source/source-correlation.jpeg)

## Changelog

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
