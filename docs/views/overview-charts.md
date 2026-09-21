# Overview charts

| | |
|--|--|
| **Id** | `overview-charts` |
| **Panel / component** | `OverviewCharts` → `src/ui/TimelineView/OverviewCharts/` |
| **Capability** | _(none)_ |
| **Phase** | M |
| **Unification** | `gap` (emulate) |
| **Sept 30 (emulate)** | **hide** |

## Sketches

**Component crops:** ![Overview charts](../../src/ui/TimelineView/OverviewCharts/visual/overview-charts.png)

_Product v930 full-frame crop for overview tracks alone is thin; use component visual as normative until a dedicated mockup lands._

## Purpose

Cube/Vector (or counter-named) overview series above the swimlane — sampling counters over time.

## View-model

| Field | Role | Required? |
|-------|------|-----------|
| `reportModel.overviewSeries[]` | Tracks `{ id, label, points[{t,v}] }` | **Required to show** |

## Hide rule

No `OverviewSeries` → **hide** the chart region entirely ([DATA-32](../context/decisions/DATA.md)). Do **not** invent series from PipeUtilization ratios.

## Compute fill

| Adapted field | Embed | Columns / notes | Schema SSOT |
|---------------|-------|-----------------|-------------|
| `overviewSeries` | `Sampling.json` `ph:"C"` | One series per counter `name`; µs→ns ([DATA-39](../context/decisions/DATA.md)) | [METRICS](../formats/compute/METRICS_AND_TRACE.md) |

## Emulate fill

| Adapted field | Embed | Columns / notes | Status |
|---------------|-------|-----------------|--------|
| `overviewSeries` | — | Unless counters packed as Sampling-like CTEF | `gap` → hide |

## Adapter

| Profile | Entry | Notes |
|---------|-------|-------|
| compute | `overviewSeriesFromSampling` in `adaptPayloads` | |
| emulate | `adaptEmulate` | Omits overview unless future counter pack |

## Related

- Spec: [OverviewCharts](../../src/ui/TimelineView/OverviewCharts/) (co-located)
- Decisions: [DATA-32](../context/decisions/DATA.md), [DATA-39](../context/decisions/DATA.md)
- Product docx §: 11.2.7
