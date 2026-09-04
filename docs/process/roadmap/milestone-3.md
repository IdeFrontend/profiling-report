# Milestone 3 — Remaining full sketch UI

**Target date:** **2026-09-15**

**Goal:** Finish sketch surfaces deferred past M1–M2.

Index: [README.md](README.md) · Previous: [milestone-2.md](milestone-2.md)

## Swimlane

| Item | Status | Features |
|------|--------|----------|
| Multiselect + context menu / pin | **New** | Rubber-band / additive select; pin row |
| ProfilerStep bands | **New** | When data exists |
| Keyboard W/S/A/D + shortcut help | **New** | |
| Dense-trace WebGL | **New** | If Canvas stress fails |
| Toolbar markers / layer control / settings | **New** | |
| Product-final DATA-36 | **Replace** | Swap interim dep encoding when Product resolves |

## Other views

| Item | Status | Features |
|------|--------|----------|
| Overview charts | **New** | When producer supplies `OverviewSeries` (DATA-32) |
| Summary DATA-33 tiles | **New** | Compute / BW / avg-util when formulas exist |
| Roofline (Product-final DATA-37) | **Replace** | Swap [M2](milestone-2.md) interim formulas/peaks when DATA-37 resolves |
| Secondary tabs | **New** | 源码 / 详情 / 缓存 (UI-37); hardware aside if DATA-34 |
| Visual regression / sketch golden | **New** | DATA-31 golden when available |

## Implementation tasks

1. Product sync: close or re-interim DATA-33 / DATA-36-final / UI-37 / DATA-37 / DATA-31 golden / DATA-34 as needed; update specs before coding each slice.
2. Overview: producer or adapter fills `OverviewSeries`; implement `OverviewCharts` time-aligned with swimlane.
3. Summary: implement DATA-33 formulas into `StatsSummaryPanel` tiles once defined.
4. Roofline: replace M2 interim point/ceiling mapping with Product-final DATA-37; keep `RooflinePanel` UI.
5. Swimlane advanced: multiselect + summary table; context menu; ProfilerStep bands if present in data; W/S/A/D + help (UI-41).
6. Secondary tabs / hardware: per UI-37/DATA-34 contracts; capability flags from host.
7. WebGL path (evolve PR #4) if Canvas stress fails on real traces; visual regression baselines.
8. Replace interim DATA-36 with Product-final encoding; migrate fixture.

## Potential blockers

| Blocker | Impact | Mitigation |
|---------|--------|------------|
| **DATA-33 formulas** still open | Cannot ship sketch-faithful summary tiles | Keep interim hide; escalate Product |
| **DATA-32 / OverviewSeries** producer missing | Overview charts stay hidden | Blocked on producer; no inventing from PIPE |
| **DATA-37** still open after M2 interim | Roofline may stay interim past 2026-09-15 | Keep M2 panel; only swap math when Product closes DATA-37 |
| **UI-37** secondary tab contents open | 源码/详情/缓存 blocked | Stay Timeline-only until contracts |
| **DATA-34** hardware aside deferred | No hardware panel | Out until Product specs |
| **DATA-31** sketch-faithful golden absent | Visual regression weak | Keep `out.rep`; add golden when available |
| **DATA-36 Product-final** may break interim fixture | Migration cost | Keep adapter boundary; version encoding |
| ProfilerStep / markers need data not in `out.rep` | Features no-op on demo | Hide without data; need richer fixture |
| WebGL complexity / shader port | Schedule risk | Gate on measured Canvas limits; Canvas remains fallback |
| PKG-3 Legal for large PyPTO ports | Blocks verbatim copy | Reimplement; Legal before paste |
| **PROC-5** acceptance owner unclear | Sign-off delay | Name owner early in M3 |

## Exit criteria

- Remaining swimlane / other-view rows above done unless Product cuts
- Specs + CI green for each shipped surface
