# SwimlaneView

| spec-id-prefix |
|----------------|
| PR-SWIMVIEW-*  |

Body row: LaneGutter | SwimlaneCanvas with shared Y scroll sync, body-local gutter resize handle, and full-width Card header strips.

## Behavior

**Card strips.** Each Card header is a full-width opaque strip spanning gutter + swimlane, painted above the gutter resize handle so the seam does not cut through Card rows. Fill/hover bind to `LANE_GROUP_HEADER_FILL` / `LANE_GROUP_HEADER_HOVER` (`#2a2a2a` / `#323232`) via `--pr-card-header-fill` / `--pr-card-header-hover`. Header **Y** comes from `layoutHeaders(model)` (same `walkVisibleRows` heights as the canvas, without an event-layout rebuild). The full strip is interactive (`pointer-events: auto`): click toggles expand/collapse (`toggle-group`); `pointerenter` clears the swim cursor (and axis timestamp via `cursor` emit). Wheel events are forwarded to `SwimlaneCanvas` so scroll/zoom still work over header chrome. Chevron + name sit in the left (gutter) column via shared `Chevron.vue`; the LaneGutter Card row is a non-interactive height spacer only.

**Body scroll.** `.pr-swim-row--body` uses `overflow: hidden` so lane scroll stays contained while ReportLayout `.pr-main` stays `overflow: visible` for overview/axis chrome at the aside seam.

**Layer order (bottom → top).** Swimlane measure fades/borders (canvas overlays) sit **below** Card strips (`z-index: 8`). The mouse-following cursor bar and Alt-measure chrome (dashed cross-lane connector, sticks, Δt, free-cursor target line, event highlights, and the pin↔body cross bridge) sit **above** the Card strips at `z-index: 9`: the strips are opaque full-row buttons, so anything below them punches a visible gap at every Card header (AC-13; same failure for Alt-measure's dashed vertical). Blue edge marks stay above that band (`z-index: 10–11`) so magnet snap markers always paint on top of the playhead / Alt-measure stems. The canvas wrap's `overflow: hidden` clips overlays to the chart column. Cursor x comes from canvas pointer emits and from the parent `cursorXRatio` prop (so viewport-axis hover keeps the full-height playhead). Gutter resize handle stays under strips (`z-index: 5`).

**Gutter resize.** The `ew-resize` handle (`data-testid="gutter-resize-handle"`) lives on the swim body seam (`z-index: 5`), under Card strips (`z-index: 8`), so it is inactive across Card bands. Overview/axis rows do not host the handle. The handle is pinned to the **used** gutter grid column (`grid-column: 1 / 2`), not `left: var(--pr-gutter-width)`, so it stays aligned when the gutter column shrinks below the token. The end line must be explicit: for abspos children, a lone `grid-column: 1` resolves end to `auto` (container padding edge) and parks the handle on the far track edge. Card-strip labels use the same column formula as the swim row.

**Narrow track.** Body/overview/axis rows use `minmax(0, var(--pr-gutter-width)) minmax(80px, 1fr)` so the chart column cannot collapse to 0 when main is narrower than the gutter token.

### Pinned lanes (sticky strip)

When **pinnedLaneIds** is non-empty, a **fixed strip** at the top of the swim body (below overview/axis chrome, above the scrolling lane body) renders **duplicate** leaf rows for each pinned id, in pin order. Original rows stay in the main scroll model at their tree positions.

| Concern | Behavior |
|---------|----------|
| Gutter | Pinned strip shows duplicate lane labels + util for each pinned leaf (same chrome as originals; pushpin shown **filled** `#4a90e2`) |
| Canvas | Pinned strip paints duplicate event rows at the same Y stack as the gutter duplicates; shares `timeWindow`, zoom, and horizontal scroll with the main canvas |
| Measure | Pinned-strip canvas uses the same `measureMode` / `measureRange` as the body (create, resize, overlay) — not pan while measure is active. Magnet follows the canvas under the pointer across pin strip ↔ body (`PR-SWIMVIEW-018`). **Alt event measure** shares one session across strip + body so users can measure between a sticky-lane event and a scroll-body event; a dashed vertical bridge connects event↔event pairs (`PR-SWIMVIEW-020`/`021`); free-cursor targets paint the cursor line on every surface (`PR-SWIMVIEW-022`) |
| Card headers | Full-width Card strips remain in the scrolling body only — pinned strip is **lane-height rows** (`22px`) without Card spacers |
| Scroll | Main body `scrollY` does not move the pinned strip; pinned strip height reduces the scroll viewport (`bodyViewportH − pinnedHeight`) |
| Unpin | Click filled pushpin on duplicate or original → parent removes id from **pinnedLaneIds**; strip row removed |
| Collapse | Pinned strip **keeps** duplicates when an ancestor Card/folder is collapsed; originals hide in the scroll body. Requires unfiltered `pinSourceModel` (not `displaySwim`). |
| Dependencies | Pinned-strip canvas pass draws events/labels only — no `dependencyGraph` / `paintDependencyLinks` in strip Y space (no beziers, dimming, or neighbor highlighting there). Main scroll canvas unchanged. |
| Cross-card | Any leaf id may be pinned regardless of Card/process; strip lists duplicates in **pin order** (may interleave Cards). |

Stacking: pinned strip sits above the scrolling lane body and below Card strips in the scroll region (`z-index` between measure chrome and Card strips — lane rows only, no overlap with Card band interaction).

**Strip animation.** The pinned strip appears/disappears over **200ms**: its height tweens through a `--pr-pinned-h` custom property (0 ↔ N·`LANE_HEIGHT`), so pinning/unpinning the first/last lane grows/shrinks the strip smoothly and the body below reflows at the same rate instead of jumping. Incremental pins while the strip is visible animate the same way (N·22 ↔ (N±1)·22). `prefers-reduced-motion: reduce` drops the transition.

## Acceptance Criteria

1. **PR-SWIMVIEW-001** — Renders gutter and canvas side by side.
2. **PR-SWIMVIEW-002** — Full-width Card strip at header Y; click emits `toggle-group`.
3. **PR-SWIMVIEW-003** — Body hosts `gutter-resize-handle` under Card strips; body row uses `overflow: hidden` for scroll containment.
4. **PR-SWIMVIEW-004** — Stacking: measure borders below Card strips (`z-index: 8`); swim cursor and Alt-measure chrome (`z-index: 9`) above Card strips; blue edge marks (`z-index: 10–11`) above the cursor / Alt-measure band; pin↔body Alt-measure bridge also at `z-index: 9`.
5. **PR-SWIMVIEW-005** — `pointerenter` on a Card strip clears the swim cursor and emits `cursor` `null` immediately.
6. **PR-SWIMVIEW-006** — Card strip fill/hover use `LANE_GROUP_HEADER_FILL` / `LANE_GROUP_HEADER_HOVER` CSS vars (no hardcoded `rgb(42…)` / `rgb(50…)`).
7. **PR-SWIMVIEW-007** — Parent `cursorXRatio` prop drives the swim cursor bar (axis hover / shared playhead).
8. **PR-SWIMVIEW-008** — Gutter resize handle pins to used grid column (`grid-column: 1 / 2`); track column uses `minmax(80px, 1fr)`.
9. **PR-SWIMVIEW-009** — When the cursor is magnetized (`cursorSnapped`), the swim vertical bar renders gray (`.pr-swim-cursor--snapped`).
10. **PR-SWIMVIEW-013** — Non-empty **pinnedLaneIds** renders sticky pinned strip above scroll body.
11. **PR-SWIMVIEW-014** — Pinned strip duplicates preserve lane ids and pin order.
12. **PR-SWIMVIEW-015** — Original leaf rows remain in tree order below; unpin removes duplicate only.
13. **PR-SWIMVIEW-016** — Pinned-strip canvas omits dependency link rendering.
14. **PR-SWIMVIEW-017** — `pinnedLaneIds` may span multiple Cards/groups; strip order follows pin order.
15. **PR-SWIMVIEW-018** — Measure magnet follows the canvas under the pointer across pin strip and body (create/resize may start on one and snap on the other).
16. **PR-SWIMVIEW-019** — Pinned strip stays populated when an ancestor of a pinned leaf is collapsed (`pinSourceModel` / full swim); scroll-body originals hide.
17. **PR-SWIMVIEW-020** — Alt event measure shares session across pin strip and body; each endpoint records the surface it was captured on so a body click on a pinned lane draws on the body instance (not the sticky duplicate). Cross-surface pairs use split sticks + Δt.
18. **PR-SWIMVIEW-021** — When Alt-measure endpoints span pin strip and body, a dashed vertical bridge connects the two lane centers at the later edge (still drawn when either edge is outside the current time window; re-projects on gutter/body resize).
19. **PR-SWIMVIEW-022** — Free-cursor Alt target (`eventId === null`) paints the full-height cursor line on both pin strip and body; stick + Δt remain only on the anchor-owning surface.
20. **PR-SWIMVIEW-023** — Changing `collapsedIds` or `pinnedLaneIds` clears any active Alt-measure session (ephemeral or pinned).
21. **PR-SWIMVIEW-024** — Ephemeral Alt-measure target is not cleared on `pointerleave` of the pin-strip or body canvas (crossing strip↔body must not blank Δt). With no sticky strip, the scroll canvas uses `solo` so leave clears live preview.
22. **PR-SWIMVIEW-025** — Pinned strip appears/disappears over 200ms via `--pr-pinned-h` height transition; enter/leave collapse to `height: 0`; `prefers-reduced-motion: reduce` drops the transition.

## Changelog
- **2026-09-03** — Pinned strip appears/disappears over 200ms via `--pr-pinned-h` height transition; reduced-motion drops it.
- **2026-09-02** — Alt-measure chrome and pin↔body bridge join the swim cursor at `z-index: 9` above Card strips (`PR-SWIMVIEW-004`).
- **2026-09-01** — Pin↔body bridge re-projects on gutter/body resize (`PR-SWIMVIEW-021`).
- **2026-09-01** — No-pin scroll canvas uses `solo` Alt role so leave clears ephemeral preview (`PR-SWIMVIEW-024`).
- **2026-09-01** — Strip/body `pointerleave` keeps ephemeral Alt target; bridge survives time-clipped edges (`PR-SWIMVIEW-021`/`024`).
- **2026-09-01** — Collapse / pin-set changes clear Alt-measure (`PR-SWIMVIEW-023`).
- **2026-09-01** — Free-cursor Alt target paints on every shared surface (`PR-SWIMVIEW-022`).
- **2026-09-01** — Alt-measure endpoints track strip vs body instance (no forced defer to sticky duplicate).
- **2026-09-01** — Pin↔body Alt-measure draws a dashed vertical cross bridge (`PR-SWIMVIEW-021`).
- **2026-08-31** — Pinned strip survives ancestor collapse via `pinSourceModel` (`PR-SWIMVIEW-019`).
- **2026-08-31** — Cross-canvas measure magnet: pin strip ↔ body (`PR-SWIMVIEW-018`).
- **2026-08-31** — Renumber pin ACs to `PR-SWIMVIEW-013`…`017` (avoid collision with #45 `010`…`012`).
- **2026-08-28** — Abspos gutter handle uses explicit `grid-column: 1 / 2` so `right: 0` is the gutter seam, not the track’s far edge.
- **2026-08-28** — Pinned-strip canvas shares measure mode/range with the body canvas.
- **2026-08-27** — After rebase onto master (`PR-SWIMVIEW-009` = cursor magnet): pin ACs are `013`…`017` (leave `010`…`012` for #45 Card metric selector). Gutter pin ACs `010`…`013` reserve `009` for #45 metrics.
- **2026-08-27** — Pinned strip: no dependency links; cross-card pin order (`PR-SWIMVIEW-016`…`017`). Tests deferred until implementation.
- **2026-08-27** — Sticky pinned-lane strip spec (`PR-SWIMVIEW-013`…`015`). Tests deferred until implementation.
- **2026-08-26** — Swim cursor moved into `SwimlaneCanvas` below blue edge marks; PR-SWIMVIEW-004.
- **2026-08-26** — `cursorSnapped` grays the swim vertical bar when the cursor is magnetized to an event edge; PR-SWIMVIEW-009.
- **2026-08-25** — Pin overlays to used grid columns; track `minmax(80px, 1fr)`; PR-SWIMVIEW-008.
- **2026-08-20** — Swim cursor follows parent `cursorXRatio`; PR-SWIMVIEW-007.
- **2026-08-20** — Body `overflow: hidden` while main column stays visible for aside-seam chrome.
- **2026-08-20** — Card strip colors from layout tokens; PR-SWIMVIEW-006.
- **2026-08-20** — Full-width strip click + clearCursor; cursor under strips; wheel forwarded; PR-SWIMVIEW-005.
- **2026-08-19** — Card header Y from `rebuildLayout`; PR-SWIMVIEW-002.
- **2026-08-13** — Measure borders below Card strips; PR-SWIMVIEW-004.
- **2026-08-13** — Full-width Card strips + body-local gutter resizer; PR-SWIMVIEW-002/003.
- **2026-08-10** — Extracted scroll sync from ProfilingReport.
