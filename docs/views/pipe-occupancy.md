# PIPE occupancy

| | |
|--|--|
| **Id** | `pipe-occupancy` |
| **Panel / component** | `PipeOccupancyPanel` → `src/ui/StatsAside/PipeOccupancyPanel/` |
| **Capability** | _(none)_ |
| **Phase** | M (+ M1 Cube\|Vector MIX toggle) |
| **Unification** | `adapt-mapper` |
| **Sept 30 (emulate)** | **in** |

## Sketches

![Compute load / PIPE bars](../ui/source/v930/compute-load.jpeg)

**Component crops:** ![PIPE bars](../../src/ui/StatsAside/PipeOccupancyPanel/visual/pipe-bars.png) · ![Cube/Vector toggle](../../src/ui/StatsAside/PipeOccupancyPanel/visual/cube-vector-toggle.png)

## Purpose

Horizontal pipe-utilization bars (Cube/Vector sides) for the selected block scope. Detail button opens compute CSV field list.

## View-model

| Field | Role | Required? |
|-------|------|-----------|
| `reportModel.pipeOccupancy[]` | Bar rows (`id`, `label`, `ratio`, `side`, …) | **Required to show** |
| `summary` / op type | MIX → show Cube\|Vector toggle | Optional |
| `computeTables` / `csvTexts` | 详情 tabs | Optional |

## Hide rule

Empty `pipeOccupancy` (missing util embeds or all-NA) → **hide** panel ([DATA-30](../context/decisions/DATA.md)). No empty chrome.

## Compute fill

| Adapted field | Embed | Columns / notes | Schema SSOT |
|---------------|-------|-----------------|-------------|
| `pipeOccupancy` | `PipeUtilization.csv` | Mean non-`NA` `aic_*` / `aiv_*` ratios; `*_time(us)` absolute ([DATA-33b](../context/decisions/interim/DATA.md), DATA-33f) | [METRICS](../formats/compute/METRICS_AND_TRACE.md) |

## Emulate fill

| Adapted field | Embed | Columns / notes | Status |
|---------------|-------|-----------------|--------|
| `pipeOccupancy` | `PipeUtilizationHist.csv` (prefer) or `PipesUtilization.csv` | Keep emulate basenames — **do not** invent `PipeUtilization.csv` ([DATA-45](../context/decisions/DATA.md)) | `adapt-mapper` |
| PIPE CSV tab | same embeds → `computeTables` | | `adapt-mapper` |

## Adapter

| Profile | Entry | Notes |
|---------|-------|-------|
| compute | `adaptPayloads` → `pipeOccupancyFromRows` | Also attaches lane `utilization` |
| emulate | `adaptEmulate` → `pipeOccupancyFromHist` / `pipeOccupancyFromPipesUtilization` | |

## Related

- UX: [UX_SPEC](../ui/UX_SPEC.md)
- FEATURE_MATRIX: PIPE occupancy bars
- Product docx §: 11.2.5 / emulate 11.2.3.4–6
- Interim: [DATA-33b](../context/decisions/interim/DATA.md)
- View catalog: [README](README.md)
