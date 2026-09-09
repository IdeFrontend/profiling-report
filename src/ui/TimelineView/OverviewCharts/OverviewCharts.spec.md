# OverviewCharts

| spec-id-prefix |
|----------------|
| PR-OV-*        |

Renders `ReportViewModel.overviewSeries` as the **统计分析** block **inside** the swim scroll body (below the time axis / pinned strips). Source: product `Sampling.json` `ph:C` ([DATA-39](../../../../docs/context/decisions/DATA.md)) — one track per counter name present. Hidden when `overviewSeries` is empty ([DATA-32](../../../../docs/context/decisions/DATA.md)).

## Layout (v930/entry + PyPTO pin)

```text
┌ time axis ─────────────────────────────────────────────┐
├ pinned lanes (sticky) ─────────────────────────────────┤
├ pinned overview tracks (sticky) ───────────────────────┤
│ ▾ 统计分析 + tracks (scroll with lanes)                │
│ Card / cores / pipes …                                 │
└────────────────────────────────────────────────────────┘
```

- **Placement:** scrollable section at the top of the swim **body** (moves with `scrollY`). Sticky duplicates of pinned series sit **below** the pinned-lane strip and **above** the scrolling body.
- **Gutter column:** width = TimelineView gutter (`gutterWidth` prop); labels left-aligned; section header with chevron + localized **统计分析** / Statistical analysis.
- **Collapsible header (v930/entry):** full-width Card-like strip (`#2a2a2a` / hover `#323232`, 40px) with `Chevron` + title; **no vertical gutter splitter** on the header (tracks keep the seam). Click **anywhere** on the strip toggles expand/collapse of all tracks (sticky pin strip stays visible).
- **Track / lane:** **16px** paint area inside a **24px** lane with an **8px** empty gap above the chart (gap is part of the series hit target). Pointer over gutter **or** chart column highlights the **whole track** with swimlane lane-hover fill (`LANE_HOVER_FILL` / `#363636`) and lifts the label to `#fff` (same chrome as main swim rows).
- **Splitters:** **1px** `#3a3a3a` horizontal border under each lane (same as lane row dividers).
- **Style:** **step-after** area + stroke (hold each sample value until the next counter event, then jump). Fill `fill-opacity ≈ 0.45` under a bright stroke. Stroke hex from `overviewSeriesStroke` ([COLOR_TOKENS](../../../../docs/ui/COLOR_TOKENS.md): Cube → `#3078F0`; other pipes → OKLCH `L+0.2` of the pipe base).
- **Y domain:** shared **0–100** (`OVERVIEW_Y_MAX`) for all tracks so util-% counters are comparable; do **not** auto-scale each series to its own peak. Values outside `[0, 100]` clamp. Non-percentage `ph:C` counters (absolute units) therefore flatten at the band ceiling — out of scope until Product defines a per-unit scale; today’s Sampling fixtures are all util %.
- **Time domain:** shared with swimlane visible `[startTime, endTime]` (canonical ns).
- **Cursor:** shared playhead (stack + axis stem, `#317af7`) continuous through the chart column from the time axis through 统计分析 down to the swim bottom — painted by SwimlaneView’s stack-cursor layer, not by this component. Hover on a **chart** column drives the playhead and shows **one** EventTooltip-styled tip listing **every** series’ step-after value at that time (track order), plus a round value-dot on **each** track at the same x — the full **24px** lane (8px gap + 16px paint) is the hit target (SVG paint is `pointer-events: none`). Tip values are the raw `args.value` number with **no unit suffix** (Sampling has no unit metadata; util-% fixtures therefore show bare numbers by design). The **hovered** series is emphasized: tip row bold with a stroke-color swatch; that track’s dot is larger (10px vs 8px). Value-dots are **teleported to `body` with `position: fixed`** so they are not cropped when v≈0 on the last track (overview sits under `translateY` / body `overflow: hidden`). The empty header-row chart band (under the axis, beside 统计分析) also drives the playhead with a real xRatio so the stem does not drop — **no tip/dots** there; gutter labels do not drive the cursor.
- **Zoom / pan:** same gestures as the swimlane — wheel is forwarded to `SwimlaneCanvas.handleWheel` (trackpad horizontal pan, Ctrl/Meta+wheel zoom anchored at pointer time, vertical lane scroll). Drag horizontally on a chart column pans the shared time window after a **4px** move threshold (disabled while `measureMode`).
- **Pin (PyPTO parity):** each track gutter has a **置顶** pushpin (hover-reveal unpinned; always visible when pinned / in sticky strip). Click toggles `pinnedOverviewIds`.

## Acceptance Criteria

1. **PR-OV-001** — Renders one labeled track per `OverviewSeries` entry; section header present.
2. **PR-OV-002** — Each track SVG is 16px tall inside a 24px lane (8px gap above the paint); consecutive lanes use a 1px `#3a3a3a` horizontal splitter; the full 24px chart column (including the gap) is the series hit target.
3. **PR-OV-003** — Mounted in the swim body below the time axis (DOM: axis → swimlane containing overview).
4. **PR-OV-004** — Series paths are step-after: value stays constant until the next sample time, then jumps (no diagonal interpolation between samples).
5. **PR-OV-005** — Track pushpin emits `pin-overview` / `unpin-overview`; sticky strip (`variant=strip`) shows pinned series in pin order **below** the lane pin strip.
6. **PR-OV-006** — Shared cursor x draws a continuous vertical playhead over the chart column (not gutter). Hovering anywhere in a chart column’s 24px lane (including the 8px gap above the paint) emits `cursor` and shows one multi-series tip (all track labels + step values at that time) plus a value-dot on **every** track; the hovered series tip row is bold with a color swatch and its dot is emphasized; dots are teleported / fixed so a zero (or near-baseline) sample on the last track is not clipped by the overview transform or parent overflow. Hovering the header-row chart band emits `cursor` with a real xRatio (no tip/dots); gutter labels do not emit `cursor`.
7. **PR-OV-007** — Wheel over overview emits `wheel` for swimlane scroll / trackpad pan / Ctrl+zoom; drag on a chart column emits `pan` (skipped while `measureMode`).
8. **PR-OV-008** — Section header is a Card-like collapsible strip (no vertical gutter splitter); click **anywhere** on the full-width header (gutter or chart band) toggles `collapsed` / `update:collapsed` and hides/shows all tracks.
9. **PR-OV-009** — Hovering a track (gutter or chart column) fills the whole 24px lane with `LANE_HOVER_FILL` (`#363636`) and lifts the series label to `#fff` (parity with swimlane whole-lane hover).
10. **PR-OV-010** — All tracks share a **0–100** Y domain (`OVERVIEW_Y_MAX`); a series whose peak is below 100 does not fill the band height. Values outside the domain clamp; non-% counters are out of scope (documented in Layout).
11. **PR-OV-011** — Ending a chart drag (pointerup / cancel) while the pointer is outside a chart column clears the value tip/dot and emits `cursor: null` (leave is ignored while dragging).
12. **PR-OV-012** — Chart drag-pan uses the same **4px** click-vs-drag threshold as `SwimlaneCanvas`; moves ≤4px do not emit `pan`.

## Visual

- [`visual/overview-charts.png`](./visual/overview-charts.png) — full 统计分析 block
- [`visual/overview-charts-gutter.png`](./visual/overview-charts-gutter.png) — gutter labels
- [`visual/overview-charts-track.png`](./visual/overview-charts-track.png) — Cube stroke+fill detail

## Dependencies

[view-models](../../../../specs/core/view-models.spec.md) PR-VM-003, [UI_OVERVIEW](../../../../docs/ui/UI_OVERVIEW.md), [COMPONENTS](../../../../docs/architecture/COMPONENTS.md).
