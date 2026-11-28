# Integration & E2E Tests

| spec-id-prefix |
|----------------|
| PR-UI-*, PR-E2E-* |

Outside-in tests verifying the full component tree and playground render correctly. These test composition — per-component units are tested in their own folders.

## Behavior

**Integration (Vitest + Vue Test Utils).** Mounts ProfilingReport with `data/out.rep` source and exercises the full component tree through prop updates and DOM queries. Verifies that loading produces visible chrome, interactions propagate state, the aside renders when data is available and hides for standalone CTEF, zoom-to-fit expands to full timeline, search filters events, and the overview brush updates the viewport.

**E2E (Playwright against playground).** Loads the playground with `data/out.rep` and verifies real browser rendering: timeline visible, hover shows tooltip, click selects event and shows detail strip, zoom-to-fit via toolbar, standalone JSON opens without aside, overview brush updates window and cursor. `?fixture=ffn_dense&renderer=webgl` compiles the WebGL curve shaders and paints selected dependency curves (jsdom never acquires `webgl2`).

## Acceptance Criteria

### Integration (PR-UI)

1. **PR-UI-001**: Mounts ProfilingReport with fixture source, shows timeline chrome.
1. **PR-UI-002**: Select emits detail payload with event name, startTime, and duration.
1. **PR-UI-003**: Aside renders summary stats and pipe occupancy when CSV data available.
1. **PR-UI-004**: Zoom-to-fit expands viewport to full timeline.
1. **PR-UI-005**: Search input filters events in swimlane.
1. **PR-UI-006**: Standalone CTEF renders timeline without aside panel.
1. **PR-UI-007**: Time overview brush emits window update events.
1. **PR-UI-008**: CSV-only report (compute/memory tables, no summary/pipe) auto-opens aside and shows toggle.
1. **PR-UI-009**: Host `timeDisplayMode: 'cycles'` falls back to wall time (select value `time`, cycles option hidden) when OpBasicInfo freq is missing.
1. **PR-UI-010**: Host `timeDisplayMode: 'cycles'` holds when OpBasicInfo freq is present (select value `cycles`, option shown).
1. **PR-UI-011**: With no host `timeDisplayMode`, a toolbar cycles choice survives a freq change to another valid MHz; falls back to time only when freq becomes missing.
1. **PR-UI-012**: Metrics-only source (no `trace.json`) renders the aside with no swimlane and no load error.
1. **PR-UI-013**: Collapsing/expanding a folder starts a tween without re-deriving the display model — `displaySwim` is the unfiltered swim identity for the whole session (collapse is paint-only); `filterCollapsedTree` is not used on the viewer hot path.
1. **PR-UI-014**: Re-clicking the same folder mid-tween reverses direction from the current `visible` (does not restart collapse from 1).
1. **PR-UI-015**: Starting a collapse/expand on a *different* group while a tween is in flight commits the in-flight target `collapsedGroupIds` before cancelling (and clears hover / clamps scroll), so the first toggle is not discarded and stale tooltips do not linger.
1. **PR-UI-018**: Collapse clamps vertical scroll to `scrollHeight - clientHeight` (not `scrollHeight`), and defers that clamp until after the gutter layout tick, so a bottom-scrolled view stays aligned with the shrinking content.
### E2E (PR-E2E)

1. **PR-E2E-001**: Playground loads `data/out.rep` and renders timeline.
1. **PR-E2E-002**: Hover over swimlane event shows tooltip.
1. **PR-E2E-003**: Click event selects it, detail strip shows name and times.
1. **PR-E2E-004**: Zoom-to-fit via toolbar renders full timeline span.
1. **PR-E2E-005**: Standalone JSON opens without CSV aside.
1. **PR-E2E-006**: Overview brush updates time window and cursor line.
1. **PR-E2E-007**: `?fixture=ffn_dense&renderer=webgl` attaches WebGL, paints selected dependency curves, and search does not rebuild the cached graph.
1. **PR-E2E-008**: Active measure toggle has `aria-pressed="true"` and renders the `measure` design icon as a 16px `currentColor` mask, so toggling retints the one glyph instead of swapping artwork.
1. **PR-E2E-009**: Relevent connector curves meet their chips flush, at any name length.
1. **PR-E2E-010**: Dragging the dock taller grows its columns with it.
1. **PR-E2E-011**: Drag marquees real events into the multi-select dock; bars fill against the widest row; a Name click hands off to DetailPanel.
1. **PR-E2E-012**: Escape cancels a marquee mid-drag and clears a committed one.
1. **PR-E2E-013**: Closing the dock immediately frees its layout space while it slides away.
1. **PR-E2E-014**: Opening the dock grows its layout height with the enter animation — the timeline must not shrink by a full dock height while the dock's layout height is still near zero (no black hole under a translateY-hidden full-height slot).
1. **PR-E2E-015**: Wheel-scrolling a tall stress fixture keeps the lane gutter `scrollTop` and each card-header screen Y locked to the same scroll offset — the scroll offset is baked into the card-strip `top` (no container `translateY`) — with no chase between gutter / cards / canvas.
1. **PR-E2E-016**: During a live marquee, holding the pointer in the bottom edge band increases gutter `scrollTop` while the marquee rect stays visible (edge autoscroll).
1. **PR-E2E-017**: Playground toolbar Export with `?locale=en` fetches `/npu-rep-html-template.txt`, stitches the loaded report using the HTML `<script>` embed slot (not marker strings inside the inlined viewer bundle), and downloads `{name}.html` whose embed slot is filled with `en`.
1. **PR-E2E-018**: Source tab is absent without source embeds and opens `source-view` (no mock badge) when they are present; returning to Timeline unmounts it (UI-37).
1. **PR-E2E-019**: Single-click an event that a closed DetailPanel would cover; after the dock height tween the selected lane row stays visible above the dock (timeline ensure-scrolls).
1. **PR-E2E-020**: The playground's **baselines** link opens the picker: the five demo reports unchecked; checking applies immediately and survives closing/reopening; 添加报告文件 / **Add report file** appends a picked file as a checked row immediately; 基线对比 / **Compare baselines** starts the comparison and closes the picker; a reload starts with nothing checked again (session-only).
1. **PR-E2E-021**: Baseline comparison in the playground: 添加报告文件 / **Add report file** + 基线对比 / **Compare baselines** adapts a browsed report whose metrics differ from the current one (host glue, real bytes) and starts the comparison on it; pressing the aside bar closes the open baselines popover. The aside's Operator select repaints per-operator tone badges on the summary cards, both tones appear across the demo operators, and demo-list entries adapt the same way (their paths are fixture URLs the glue fetches).
1. **PR-E2E-022**: The aside comparison bar is ABSENT while no comparison row exists; selecting baselines alone keeps it hidden, 基线对比 / **Compare baselines** creates the default row on the first checked baseline (the dropdown reads its derived title), the row's dropdown lists exactly the checked set (no Not-selected sentinel), picks a row's report host-owned, and unchecking that report + Compare re-defaults the row to the remaining baseline; 取消对比 / **Cancel comparison** clears the rows.
1. **PR-E2E-023**: Each row's Operator dropdown defaults to the pack's operator MATCHING the open report's opName (its first operator otherwise), keeps the pick as the host-owned row edit, re-defaults the same way on a report switch, and works for browsed picks too; 添加报告文件 / **Add report file** stays available while comparing and its pick is added to the checked set immediately; the baselines popover closes on the aside-bar press (review PR #234).
1. **PR-E2E-024**: PIPE comparison: with a comparison started on a demo baseline (基线对比 / **Compare baselines**), every PIPE row keeps ONE bar (never a second baseline track); its value line carries the baseline delta — a white arrow badge, a gap, then the unsigned percentage-point magnitude in white — after the in-bar value (or at the same slot when the row has none), and the percent at the track's right stays the current percent. Switching the Operator repaints the delta; on a cube fixture (gelu) the Cube toggle rows carry the same one-bar delta without an in-bar value; the compute details overlay paints delta badges on the SAME line right of its field values, left-aligned.
1. **PR-E2E-025**: Memory load analysis comparison: the chrome SVG and the label layout stay master's; with no comparison row the topology renders **no** delta badges; starting a comparison on a demo baseline (基线对比 / **Compare baselines**) paints an arrow-only, tone-classed badge on every comparable node percentage (the six in-box unit utilities and the L2 peak — never the arrows' GB/s values), horizontally centred below the value with no inline numbers, and hovering it opens the popup with the current percentage and the baseline row. The aside Operator switch repaints the badge deltas, 取消对比 / **Cancel comparison** (or removing the baseline's rows) removes them, and a baseline **switch** keeps the badge elements mounted on every sampled animation frame (in-place update, no tear-down). Measured through the svg's screen CTM, each circle is centred on its value's x, shrinks to stay inside the element frame, and carries a full two-subpath arrow on a white fill.
1. **PR-E2E-026**: Multiple comparison rows: checking two baselines + 基线对比 / **Compare baselines** gives the default row for the first; `+` appends a second row for the **same report's next operator** (its own select testids) and stays **enabled** — the cap is the sum of the checked baselines' operator counts, not the baseline count, so a report repeats with different operators; walking the first report's operators is exhausted before moving to the next checked baseline. `−` removes a row (absent on the first row) and re-enables the `+`. The first row paints the inline deltas; hovering one opens the popup listing the current value first and then every row's own value + delta (no zero), and a single row opens the same popup with just that row.

## Dependencies

[UX_SPEC.md](../../docs/ui/UX_SPEC.md) (scenarios S1–S3), [INTERACTIONS.md](../../docs/ui/INTERACTIONS.md).

## Changelog
- **2026-11-27** — Baselines popup (PR #273 requirements): PR-E2E-020..026 restated for the immediate-selection flow — every toggle applies, Compare baselines starts and closes, Cancel replaces it while comparing, and the aside bar is gated by comparison rows (not the checked set).
- **2026-11-23** — PR-E2E-022/023/024 restated for the multi-row comparison contract, and PR-E2E-026 added: rows add/remove with report + operator dropdowns, row 0 drives the aside, the others surface in the hover popup.
- **2026-11-16** — Review PR #234: PR-E2E-021..023 restated — the aside Baseline bar hides while nothing is checked, the first added baseline autoselects, the Operator default matches the open report's opName, and pressing the aside bar closes the baselines popover.

- **2026-11-23** — PR-E2E-025 restated for the master chrome: the comparison adds only a white arrow badge centred under each percentage value (no inline delta text); hovering it opens the baseline-values popup, and the geometry assertions keep the circle centred on its value and inside the element frame.
- **2026-11-13** — PR-E2E-025 asserted the topology badge **rhythm geometry** in the real browser: each badge's circle+text group is centred on its value, its bottom sits inside the element frame, and its delta text was fitted inside the element box's width bound (chrome frame bounds mapped to CSS px through the svg's screen CTM).
- **2026-11-13** — PR-E2E-025: memory load analysis comparison — no baseline means no badges; a selected demo baseline paints per-node percentage tone badges that repaint per operator, disappear on unselect, and stay mounted across a baseline switch.
- **2026-11-12** — PR-E2E-024: PIPE dual classic-layout bars (value left, percent right; 基线 word on the baseline bar's right) + same-line details delta badges.
- **2026-11-12** — PR-E2E-021 restated for the bar-driven comparison: the removed 基线 operator row is gone; the aside Operator select drives per-operator badge values and both tones across the eight demo operators, for browsed and demo-fetched packs alike.
- **2026-11-12** — PR-E2E-021: the sidebar comparison slice e2e — per-operator, per-card, per-baseline badge coverage with both tones (demo packs synthesize eight scaled operators on every metric family).
- **2026-11-12** — ТЗ rework (PR-E2E-020/022/023 restated): the picker is a single checkbox view — the checked set IS the baseline list; the aside dropdowns always render with Not selected sentinels; nothing is seeded, nothing selected by default; PR-E2E-022 covers the checkbox flow (pre-checked duplicates stay single).
- **2026-11-11** — PR-E2E-020 restated: baselines are session-only in the bundled hosts — the `?baselines=sample` link seeds the demo list (radio selection, none by default), a custom pick dies with the page, no storage anywhere.
- **2026-10-23** — PR-E2E-019: closed-dock single-click ensure-scrolls the selected row above the DetailPanel (wait for dock height to settle; Vue enter-from + 200ms ease can outlast a 280ms cap).
- **2026-10-23** — PR-E2E-018: the default sample now has real Source embeds, so the absent-tab check uses `vector_muladd`.
- **2026-10-05** — PR-E2E-017: playground HTML export (template fetch + stitch download). Vite `%ENV%` must not strip embed placeholders; template is served as `.txt`.
- **2026-09-13** — PR-E2E-015/016: scroll-layer lock under wheel, and marquee bottom-edge autoscroll in Chromium (jsdom cannot chase real layout + RAF edge scroll together).
- **2026-09-12** — PR-E2E-014: dock enter must not reserve a full-height flex slot while still visually empty (black-hole regression vs master).
- **2026-09-11** — PR-UI-013: display model identity never changes on collapse/expand (`filterCollapsedTree` left the viewer hot path; rest collapse is paint-only).
- **2026-09-07** — PR-UI-015: different-group toggle mid-tween commits the in-flight collapse target before starting the new tween.
- **2026-09-07** — PR-UI-014: mid-tween re-click on the same folder reverses from the current `visible`.
- **2026-09-04** — PR-UI-013: collapse/expand tween keeps the display model identity stable (no per-frame `filterCollapsedTree` / WebGL mesh rebuild).
- **2026-09-03** — PR-UI-012: metrics-only report (no `trace.json`) renders the aside without a timeline instead of a hard error.
- **2026-09-03** — PR-E2E-011: product 160-byte `npu-rep` sample (`?fixture=npu160`) renders in the playground via in-browser `parseNpuRep160`.
- **2026-09-01** — PR-E2E-008 now checks the `PrIcon` mask and its per-state tint. The HDesign asset replaced the hand-drawn glyph, so the arrowhead `fill="none"` assertion had nothing to bind to and PR-TOOLBAR-007c was withdrawn with it.
- **2026-08-25** — PR-E2E-011/012: marquee multi-select in Chromium. Only a real browser has the gutter resize handle overlapping the canvas's left edge and a layout engine that sizes the inline bars, so jsdom cannot catch either.
- **2026-08-20** — PR-E2E-008 structural (no pixel crop diff); defers icon geometry to PR-TOOLBAR-007c.
- **2026-08-20** — PR-E2E-009: chip-to-curve join measured in a real layout engine. Chips are content-sized in jsdom too, so only a browser can catch a short name sitting ~28px short of its connector.
- **2026-08-19** — PR-E2E-007: Chromium WebGL dependency curves (`ffn_dense`).
- **2026-08-12** — PR-E2E-008 measure toggle icon vs design crop.
- **2026-08-05** — Initial spec. Core behaviors established.
