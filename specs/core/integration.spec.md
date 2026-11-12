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
1. **PR-E2E-020**: The playground's **baselines** link opens the picker's checkbox view (the single view): the five demo reports unchecked, checking rows survives closing the popover, Browse appends the picked file as a checked row, and a reload starts with nothing checked again (session-only).
1. **PR-E2E-021**: Baseline comparison in the playground: Browse a report whose metrics differ from the current one adapts it (host glue, real bytes) and the aside's always-visible bar drives the comparison — the Operator select repaints per-operator tone badges on the summary cards, both tones appear across the demo operators, and demo-list entries adapt the same way (their paths are fixture URLs the glue fetches).
1. **PR-E2E-024**: PIPE comparison: with a demo baseline selected, every PIPE row shows two bars in the SAME classic layout (value left, percent right); the baseline bar's right text is 基线 + its own value + % (values, never deltas) and the label column stays the metric label alone; on a cube fixture (gelu) the Cube toggle shows baseline bars whose values differ per baseline AND change when the aside Operator switches; the compute details overlay paints delta badges on the SAME line right of its field values.
1. **PR-E2E-022**: The aside Baseline dropdown always renders (Not selected when nothing is checked), lists exactly the checked set + Not selected, picks globally, and unchecking the selected report clears the selection back to Not selected.
1. **PR-E2E-023**: The aside Operator dropdown defaults to the selected baseline's first operator, keeps a session-local pick, re-defaults on baseline change, and works for browsed picks too.

## Dependencies

[UX_SPEC.md](../../docs/ui/UX_SPEC.md) (scenarios S1–S3), [INTERACTIONS.md](../../docs/ui/INTERACTIONS.md).

## Changelog
- **2026-11-12** — PR-E2E-024: PIPE dual classic-layout bars (value left, percent right; 基线 word on the baseline bar's right) + same-line details delta badges.
- **2026-11-12** — PR-E2E-021 restated for the bar-driven comparison: the removed 基线 operator row is gone; the aside Operator select drives per-operator badge values and both tones across the eight demo operators, for browsed and demo-fetched packs alike.
- **2026-11-12** — PR-E2E-021: the sidebar comparison slice e2e — per-operator, per-card, per-baseline badge coverage with both tones (demo packs synthesize eight scaled operators on every metric family).
- **2026-11-12** — ТЗ rework (PR-E2E-020/022/023 restated): the picker is a single checkbox view — the checked set IS the baseline list; the aside dropdowns always render with Not selected sentinels.
y saved list — nothing seeded, nothing selected) + PR-E2E-022: the recent-reports checkbox flow (Add Selected / pre-checked duplicates / Set current as Baseline).
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
