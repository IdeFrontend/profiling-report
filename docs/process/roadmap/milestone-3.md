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
| Product-final Q9 | **Replace** | Swap interim dep encoding when Product resolves |

## Other views

| Item | Status | Features |
|------|--------|----------|
| Overview charts | **New** | When producer supplies `OverviewSeries` (Q5) |
| Summary Q6 tiles | **New** | Compute / BW / avg-util when formulas exist |
| Roofline (Product-final Q11) | **Replace** | Swap [M2](milestone-2.md) interim formulas/peaks when Q11 resolves |
| Secondary tabs | **New** | 源码 / 详情 / 缓存 (Q10); hardware aside if Q7 |
| Visual regression / sketch golden | **New** | Q4 golden when available |

## Implementation tasks

1. Product sync: close or re-interim Q6 / Q9-final / Q10 / Q11 / Q4 golden / Q7 as needed; update specs before coding each slice.
2. Overview: producer or adapter fills `OverviewSeries`; implement `OverviewCharts` time-aligned with swimlane.
3. Summary: implement Q6 formulas into `StatsSummaryPanel` tiles once defined.
4. Roofline: replace M2 interim point/ceiling mapping with Product-final Q11; keep `RooflinePanel` UI.
5. Swimlane advanced: multiselect + summary table; context menu; ProfilerStep bands if present in data; W/S/A/D + help (Q19).
6. Secondary tabs / hardware: per Q10/Q7 contracts; capability flags from host.
7. WebGL path (evolve PR #4) if Canvas stress fails on real traces; visual regression baselines.
8. Replace interim Q9 with Product-final encoding; migrate fixture.

## Potential blockers

| Blocker | Impact | Mitigation |
|---------|--------|------------|
| **Q6 formulas** still open | Cannot ship sketch-faithful summary tiles | Keep interim hide; escalate Product |
| **Q5 / OverviewSeries** producer missing | Overview charts stay hidden | Blocked on producer; no inventing from PIPE |
| **Q11** still open after M2 interim | Roofline may stay interim past 2026-09-15 | Keep M2 panel; only swap math when Product closes Q11 |
| **Q10** secondary tab contents open | 源码/详情/缓存 blocked | Stay Timeline-only until contracts |
| **Q7** hardware aside deferred | No hardware panel | Out until Product specs |
| **Q4** sketch-faithful golden absent | Visual regression weak | Keep `out.rep`; add golden when available |
| **Q9 Product-final** may break interim fixture | Migration cost | Keep adapter boundary; version encoding |
| ProfilerStep / markers need data not in `out.rep` | Features no-op on demo | Hide without data; need richer fixture |
| WebGL complexity / shader port | Schedule risk | Gate on measured Canvas limits; Canvas remains fallback |
| Q18 Legal for large PyPTO ports | Blocks verbatim copy | Reimplement; Legal before paste |
| **Q21** acceptance owner unclear | Sign-off delay | Name owner early in M3 |

## Exit criteria

- Remaining swimlane / other-view rows above done unless Product cuts
- Specs + CI green for each shipped surface
