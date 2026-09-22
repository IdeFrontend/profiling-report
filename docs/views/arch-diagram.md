# Architecture Diagram

| | |
|--|--|
| **Id** | `arch-diagram` |
| **Panel / component** | Same as compute: `MemoryTopologyPanel` + `memory-topology.svg` (interim plated stand-in until biprof SVG — [DATA-49](../context/questions/DATA.md)) |
| **Capability** | `archDiagram` |
| **Phase** | M4 (emulate Sept 30) |
| **Unification** | **One chrome + one `memoryTopology` VM + emulate adapter only** (compute uses [memory-topology](memory-topology.md) / `memoryDiagram`) |
| **Sept 30 (emulate)** | **in** |

## Purpose

Biprof **Architecture Diagram** (§11.2.3.1): path/unit bandwidth and related metrics from `ArchDiagramMetrics`.

Sept 30 fills the Asc Toolkit plated topology chrome (**448×423**; AIC + AIV × 2) — the **same** asset and `reportModel.memoryTopology` carrier as compute 内存负载分析. Capability remains **`archDiagram`** (data gate; not compute `memoryDiagram`). UI title **内存负载分析** / Memory load analysis. Full biprof chrome / richer model: [DATA-49](../context/questions/DATA.md).

## Architecture (normative)

Do **not** introduce a second topology VM or a second chrome for emulate. Adapter: `topologyFromArchDiagramMetrics` only. Shared plated edge ids with compute (`TOPOLOGY_SLOT_EDGE_IDS`); field map is DATA-48a / `ARCH_DIAGRAM_EDGE_MAP`.

## View-model

| Field | Role | Required? |
|-------|------|-----------|
| `reportModel.memoryTopology` | Same plated nodes + edges as compute | **Required to show** stand-in |
| capability `archDiagram` | Feature gate (emulate) | Set when drawable |

## Hide rule

Nothing drawable → omit diagram ([DATA-30](../context/decisions/DATA.md)).

## Emulate fill

| Adapted field | Embed | Columns / notes | Status |
|---------------|-------|-----------------|--------|
| `memoryTopology` | `ArchDiagramMetrics.csv` | Parameter→slot + **gaps** below ([DATA-48a](../context/decisions/interim/DATA.md)); SSOT `ARCH_DIAGRAM_EDGE_MAP` / `ARCH_DIAGRAM_UNPLATED_HTML_BASES`; gelu HTML `*_gbs` ids are **evidence** for [DATA-48](../context/questions/DATA.md) (open) | `adapt-mapper` |
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


<a id="html-gaps"></a>

### Explicit gaps (HTML inventory present, not plated)

| Gap | Why out |
|-----|---------|
| HTML bases `aic_l0c_to_all_syn`, `aic_l0c_to_l1`, `aic_l0c_to_out`, `aic_l0c_to_ub0/1` | No Asc chrome plate (L0C→OUT / UB / all) |
| `aiv{0,1}_ub_to_l1` | No UB→L1 plate |
| `aiv{0,1}_out_to_simt` / `simt_to_out`, `ub_to_simt` / `simt_to_ub`, `cache_to_simt` / `simt_to_cache` | SIMT / DataCache corridors unplated (UI-38) |
| Entire HTML `*_ratio` / `*_cnt` Bandwidth tabs (except L2 peak) | Per-request / count views; util ratios other than `l2_cached_ratio` not mapped to `plates` |
| HTML util ratios `aic_cube_ratio`, `aic_*_scalar_ratio`, `aiv{0,1}_simd/simt/scalar_ratio` | Emulate interim paints no UI-49 badges from ArchDiagramMetrics |

Code SSOT: `ARCH_DIAGRAM_EDGE_MAP` / `ARCH_DIAGRAM_UNPLATED_HTML_BASES` / `ARCH_DIAGRAM_L2_PEAK_PARAM` in `emulateMemoryTopology.ts`; locked by `PR-ASIM-008` / `PR-ASIM-008b`.

Set capability **`archDiagram`** when `hasDrawableTopology` (do **not** advertise emulate as `memoryDiagram`). Do **not** use `MemoryRWAccesses` (heatmap — [DATA-49](../context/questions/DATA.md)).

## Adapter

| Profile | Entry | Notes |
|---------|-------|-------|
| emulate | `topologyFromArchDiagramMetrics` in `adaptEmulate` / `emulateMemoryTopology.ts` | Capability `archDiagram` when drawable |
| compute | — | Compute uses [memory-topology](memory-topology.md) / `memoryDiagram` |

## Related

- Product: MHTML §11.2.3.1; delivery [milestone-4](../process/roadmap/milestone-4.md)
- Open: [DATA-48](../context/questions/DATA.md), [DATA-49](../context/questions/DATA.md)
- Shared chrome packet: [memory-topology](memory-topology.md)
