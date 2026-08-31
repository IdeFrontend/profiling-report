# SwimlaneView

| spec-id-prefix |
|----------------|
| PR-SWIMVIEW-*  |

Body row: LaneGutter | SwimlaneCanvas with shared Y scroll sync, body-local gutter resize handle, and full-width Card header strips.

## Behavior

**Card strips.** Each Card header is a full-width opaque strip spanning gutter + swimlane, painted above the gutter resize handle so the seam does not cut through Card rows. Fill/hover bind to `LANE_GROUP_HEADER_FILL` / `LANE_GROUP_HEADER_HOVER` (`#2a2a2a` / `#323232`) via `--pr-card-header-fill` / `--pr-card-header-hover`. Header **Y** comes from `layoutHeaders(model)` (same `walkVisibleRows` heights as the canvas, without an event-layout rebuild). The full strip is interactive (`pointer-events: auto`): click toggles expand/collapse (`toggle-group`); `pointerenter` clears the swim cursor (and axis timestamp via `cursor` emit). Wheel events are forwarded to `SwimlaneCanvas` so scroll/zoom still work over header chrome. Chevron + name sit in the left (gutter) column via shared `Chevron.vue`; the LaneGutter Card row is a non-interactive height spacer only.

**Body scroll.** `.pr-swim-row--body` uses `overflow: hidden` so lane scroll stays contained while ReportLayout `.pr-main` stays `overflow: visible` for overview/axis chrome at the aside seam.

**Layer order (bottom → top).** Swimlane measure fades/borders (canvas overlays) sit **below** Card strips. The mouse-following cursor bar lives inside `SwimlaneCanvas` (`z-index: 3`, above the event canvas, below blue edge marks at `z-index: 4–5`) so magnet snap markers always paint on top of the gray/blue playhead stem. Card strips remain on top (`z-index: 8`). Its x position comes from canvas pointer emits and from the parent `cursorXRatio` prop (so viewport-axis hover keeps the full-height playhead). Gutter resize handle stays under strips (`z-index: 5`).

**Gutter resize.** The `ew-resize` handle (`data-testid="gutter-resize-handle"`) lives on the swim body seam (`z-index: 5`), under Card strips (`z-index: 8`), so it is inactive across Card bands. Overview/axis rows do not host the handle. The handle is pinned to the **used** gutter grid column (`grid-column: 1 / 2`), not `left: var(--pr-gutter-width)`, so it stays aligned when the gutter column shrinks below the token. The end line must be explicit: for abspos children, a lone `grid-column: 1` resolves end to `auto` (container padding edge) and parks the handle on the far track edge. Card-strip labels use the same column formula as the swim row.

**Narrow track.** Body/overview/axis rows use `minmax(0, var(--pr-gutter-width)) minmax(80px, 1fr)` so the chart column cannot collapse to 0 when main is narrower than the gutter token.

### Pinned lanes (sticky strip)

When **pinnedLaneIds** is non-empty, a **fixed strip** at the top of the swim body (below overview/axis chrome, above the scrolling lane body) renders **duplicate** leaf rows for each pinned id, in pin order. Original rows stay in the main scroll model at their tree positions.

| Concern | Behavior |
|---------|----------|
| Gutter | Pinned strip shows duplicate lane labels + util for each pinned leaf (same chrome as originals; pushpin shown **filled** `#4a90e2`) |
| Canvas | Pinned strip paints duplicate event rows at the same Y stack as the gutter duplicates; shares `timeWindow`, zoom, and horizontal scroll with the main canvas |
| Measure | Pinned-strip canvas uses the same `measureMode` / `measureRange` as the body (create, resize, overlay) — not pan while measure is active |
| Card headers | Full-width Card strips remain in the scrolling body only — pinned strip is **lane-height rows** (`22px`) without Card spacers |
| Scroll | Main body `scrollY` does not move the pinned strip; pinned strip height reduces the scroll viewport (`bodyViewportH − pinnedHeight`) |
| Unpin | Click filled pushpin on duplicate or original → parent removes id from **pinnedLaneIds**; strip row removed |
| Dependencies | Pinned-strip canvas pass draws events/labels only — no `dependencyGraph` / `paintDependencyLinks` in strip Y space (no beziers, dimming, or neighbor highlighting there). Main scroll canvas unchanged. |
| Cross-card | Any leaf id may be pinned regardless of Card/process; strip lists duplicates in **pin order** (may interleave Cards). |

Stacking: pinned strip sits above the scrolling lane body and below Card strips in the scroll region (`z-index` between measure chrome and Card strips — lane rows only, no overlap with Card band interaction).

## Acceptance Criteria

1. **PR-SWIMVIEW-001** — Renders gutter and canvas side by side.
2. **PR-SWIMVIEW-002** — Full-width Card strip at header Y; click emits `toggle-group`.
3. **PR-SWIMVIEW-003** — Body hosts `gutter-resize-handle` under Card strips; body row uses `overflow: hidden` for scroll containment.
4. **PR-SWIMVIEW-004** — Stacking: measure borders below Card strips (`z-index: 8`); swim cursor (`z-index: 3`) below blue edge marks (`z-index: 4–5`).
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

## Changelog
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
