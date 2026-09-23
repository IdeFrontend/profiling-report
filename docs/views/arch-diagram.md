# Architecture Diagram

| | |
|--|--|
| **Id** | `arch-diagram` |
| **Panel / component** | Interim: `MemoryTopologyPanel` → `src/ui/StatsAside/MemoryTopologyPanel/` (plated stand-in until biprof SVG) |
| **Capability** | `archDiagram` |
| **Phase** | M4 (emulate Sept 30) |
| **Unification** | `adapt-mapper` (emulate) |
| **Sept 30 (emulate)** | **in** |

## Purpose

Biprof **Architecture Diagram** (§11.2.3.1): path/unit bandwidth and related metrics from `ArchDiagramMetrics`.

Sept 30 uses the Asc Toolkit plated topology chrome as an **interim stand-in** — same `reportModel.memoryTopology` carrier and UI title **内存负载分析** / Memory load analysis as compute. Capability remains **`archDiagram`** (data gate; not compute `memoryDiagram`). Full biprof chrome / richer model: [DATA-49](../context/questions/DATA.md).

## View-model

| Field | Role | Required? |
|-------|------|-----------|
| `reportModel.memoryTopology` | Interim plated nodes + edges | **Required to show** stand-in |
| capability `archDiagram` | Feature gate (emulate) | Set when drawable |

## Hide rule

Nothing drawable → omit diagram ([DATA-30](../context/decisions/DATA.md)).

## Emulate fill

| Adapted field | Embed | Columns / notes | Status |
|---------------|-------|-----------------|--------|
| `memoryTopology` (carrier) | `ArchDiagramMetrics.csv` | Parameter→slot map below ([DATA-48a](../context/decisions/interim/DATA.md)) | `adapt-mapper` |
| Heatmap | `MemoryRWAccesses.csv` | Different surface (§11.2.3.2) | **out** Sept 30 |

<a id="parameter-slot-map"></a>

### ArchDiagramMetrics → slot (DATA-48a)

Single embed, EAV rows — **no FK join**. Map `ArchDiagramParameterName` → slot via the table below; value = `ArchDiagramParameterValue`. Dual AIV0/AIV1 params: **average** when both present (`pickValue`). Reuse compute edge `from`/`to` node ids from `memoryTopology.ts`. No in-box util plates on this path.

| VM field / slot | Source embed(s) | Join key(s) | Derivation |
|-----------------|-----------------|-------------|------------|
| `edges[gm-l2-read].label` | `ArchDiagramMetrics.csv` | name = `hbm_to_l2_syn_gbs` | `{n} GB/s` |
| `edges[gm-l2-write].label` | same | `l2_to_hbm_syn_gbs` | `{n} GB/s` |
| `edges[l2-l1-read].label` | same | `aic_out_to_l1_gbs` | `{n} GB/s` |
| `edges[l1-l0a]` / `[l1-l0b]` | same | `aic_l1_to_l0a_gbs` / `aic_l1_to_l0b_gbs` | `{n} GB/s` |
| `edges[l0a-cube]` / `[l0b-cube]` | same | `aic_l0a_to_cube_gbs` / `aic_l0b_to_cube_gbs` | `{n} GB/s` |
| `edges[cube-l0c]` / `[l0c-cube]` | same | `aic_cube_to_l0c_gbs` / `aic_l0c_to_cube_gbs` | `{n} GB/s` |
| `edges[l2-ub]` | same | `aiv0_out_to_ub_gbs`, `aiv1_out_to_ub_gbs` | average when both present |
| `edges[ub-l2]` | same | `aiv0_ub_to_out_gbs` / `aiv1_ub_to_out_gbs` | average |
| `edges[ub-vec]` / `[vec-ub]` | same | `aiv*_ub_to_simd_gbs` / `aiv*_simd_to_ub_gbs` | average |
| `nodes[l2].peakPct` | same | `l2_cached_ratio` | numeric peak % |
| capability | — | — | `archDiagram` when `hasDrawableTopology` (not `memoryDiagram`) |

| Slot / plate | Parameter |
|--------------|-----------|
| `gm-l2-read` | `hbm_to_l2_syn_gbs` |
| `gm-l2-write` | `l2_to_hbm_syn_gbs` |
| `l2-l1-read` | `aic_out_to_l1_gbs` |
| `l1-l0a` / `l1-l0b` | `aic_l1_to_l0a_gbs` / `aic_l1_to_l0b_gbs` |
| `l0a-cube` / `l0b-cube` | `aic_l0a_to_cube_gbs` / `aic_l0b_to_cube_gbs` |
| `cube-l0c` / `l0c-cube` | `aic_cube_to_l0c_gbs` / `aic_l0c_to_cube_gbs` |
| `l2-ub` | `aiv0_out_to_ub_gbs` (AIV0), `aiv1_out_to_ub_gbs` (AIV1) — average when both present |
| `ub-l2` | `aiv0_ub_to_out_gbs` / `aiv1_ub_to_out_gbs` |
| `ub-vec` | `aiv0_ub_to_simd_gbs` / `aiv1_ub_to_simd_gbs` |
| `vec-ub` | `aiv0_simd_to_ub_gbs` / `aiv1_simd_to_ub_gbs` |
| L2 `peakPct` | `l2_cached_ratio` |

Code: `topologyFromArchDiagramMetrics` in `emulateMemoryTopology.ts`.

Set capability **`archDiagram`** when `hasDrawableTopology` (do **not** advertise emulate as `memoryDiagram`). Do **not** use `MemoryRWAccesses` (heatmap — [DATA-49](../context/questions/DATA.md)).

## Adapter

| Profile | Entry | Notes |
|---------|-------|-------|
| emulate | `topologyFromArchDiagramMetrics` in `adaptEmulate` | Capability `archDiagram` when drawable |
| compute | — | Compute uses [memory-topology](memory-topology.md) / `memoryDiagram` |

## Related

- Product: MHTML §11.2.3.1; delivery [milestone-4](../process/roadmap/milestone-4.md)
- Open: [DATA-48](../context/questions/DATA.md), [DATA-49](../context/questions/DATA.md)
- Interim chrome packet: [memory-topology](memory-topology.md)
