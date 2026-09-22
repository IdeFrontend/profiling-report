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

**Rule (product table):** for `OpType == MIX`, show **Cube \| Vector** segmented control and the active side’s bars (plus ICache rates when present). Non-MIX ops show only the relevant Cube or Vector set; omit or placeholder `NA` values. Use the column tables below — not a single combined bar list.

<a id="cube-occupancy"></a>

### Cube occupancy

| # | Display | Field | Source |
| --- | --- | --- | --- |
| 1 | Cube | `aic_cube_ratio` | `PipeUtilization.csv` |
| 2 | MTE2 | `aic_mte2_ratio` | `PipeUtilization.csv` |
| 3 | MTE1 | `aic_mte1_ratio` | `PipeUtilization.csv` |
| 4 | FIXP | `aic_fixpipe_ratio` | `PipeUtilization.csv` |
| 5 | Scalar | `aic_scalar_ratio` | `PipeUtilization.csv` |
| 6 | ICache Miss | `aic_icache_miss_rate` | `PipeUtilization.csv` |

<a id="vector-occupancy"></a>

### Vector occupancy

| # | Display | Field | Source |
| --- | --- | --- | --- |
| 1 | Vector | `aiv_vec_ratio` | `PipeUtilization.csv` |
| 2 | MTE2 | `aiv_mte2_ratio` | `PipeUtilization.csv` |
| 3 | MTE3 | `aiv_mte3_ratio` | `PipeUtilization.csv` |
| 4 | Scalar | `aiv_scalar_ratio` | `PipeUtilization.csv` |
| 5 | ICache Miss | `aiv_icache_miss_rate` | `PipeUtilization.csv` |

In-bar absolute (DATA-18, [DATA-33f](../context/decisions/interim/DATA.md)): mean non-`NA` matching `*_time(us)` for that family/side; omit when absent. Include **ICache Miss** rows when the corresponding `*_icache_miss_rate` mean is present (no time column → no absolute).

## Emulate fill

| Adapted field | Embed | Columns / notes | Status |
|---------------|-------|-----------------|--------|
| `pipeOccupancy` | `PipeUtilizationHist.csv` (prefer) or `PipesUtilization.csv` | Keep emulate basenames — **do not** invent `PipeUtilization.csv` ([DATA-45](../context/decisions/interim/DATA.md#data-45)) | `adapt-mapper` |
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
