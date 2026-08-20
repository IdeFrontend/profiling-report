# SwimlaneView

| spec-id-prefix |
|----------------|
| PR-SWIMVIEW-*  |

Body row: LaneGutter | SwimlaneCanvas with shared Y scroll sync, body-local gutter resize handle, and full-width Card header strips.

## Behavior

**Card strips.** Each Card header is a full-width opaque strip spanning gutter + swimlane, painted above the gutter resize handle so the seam does not cut through Card rows. Fill/hover bind to `LANE_GROUP_HEADER_FILL` / `LANE_GROUP_HEADER_HOVER` (`#2a2a2a` / `#323232`) via `--pr-card-header-fill` / `--pr-card-header-hover`. Header **Y** comes from `layoutHeaders(model)` (same `walkVisibleRows` heights as the canvas, without an event-layout rebuild). The full strip is interactive (`pointer-events: auto`): click toggles expand/collapse (`toggle-group`); `pointerenter` clears the swim cursor (and axis timestamp via `cursor` emit). Wheel events are forwarded to `SwimlaneCanvas` so scroll/zoom still work over header chrome. Chevron + name sit in the left (gutter) column via shared `Chevron.vue`; the LaneGutter Card row is a non-interactive height spacer only.

**Body scroll.** `.pr-swim-row--body` uses `overflow: hidden` so lane scroll stays contained while ReportLayout `.pr-main` stays `overflow: visible` for overview/axis chrome at the aside seam.

**Layer order (bottom → top).** Swimlane measure fades/borders (canvas overlays) sit **below** Card strips. The mouse-following cursor bar is a DOM overlay **under** Card strips (`z-index: 7`, `pointer-events: none`) so it does not paint over header chrome. Gutter resize handle stays under strips (`z-index: 5`).

**Gutter resize.** The `ew-resize` handle (`data-testid="gutter-resize-handle"`) lives on the swim body seam (`z-index: 5`), under Card strips (`z-index: 8`), so it is inactive across Card bands. Overview/axis rows do not host the handle.

## Acceptance Criteria

1. **PR-SWIMVIEW-001** — Renders gutter and canvas side by side.
2. **PR-SWIMVIEW-002** — Full-width Card strip at header Y; click emits `toggle-group`.
3. **PR-SWIMVIEW-003** — Body hosts `gutter-resize-handle` under Card strips; body row uses `overflow: hidden` for scroll containment.
4. **PR-SWIMVIEW-004** — Stacking: measure borders below Card strips (`z-index: 8`); swim cursor under strips (`z-index: 7`).
5. **PR-SWIMVIEW-005** — `pointerenter` on a Card strip clears the swim cursor and emits `cursor` `null` immediately.
6. **PR-SWIMVIEW-006** — Card strip fill/hover use `LANE_GROUP_HEADER_FILL` / `LANE_GROUP_HEADER_HOVER` CSS vars (no hardcoded `rgb(42…)` / `rgb(50…)`).

## Changelog
- **2026-08-20** — Body `overflow: hidden` while main column stays visible for aside-seam chrome.
- **2026-08-20** — Card strip colors from layout tokens; PR-SWIMVIEW-006.
- **2026-08-20** — Full-width strip click + clearCursor; cursor under strips; wheel forwarded; PR-SWIMVIEW-005.
- **2026-08-19** — Card header Y from `rebuildLayout`; PR-SWIMVIEW-002.
- **2026-08-13** — Measure borders below Card strips; PR-SWIMVIEW-004.
- **2026-08-13** — Full-width Card strips + body-local gutter resizer; PR-SWIMVIEW-002/003.
- **2026-08-10** — Extracted scroll sync from ProfilingReport.
