# Memory topology

| | |
|--|--|
| **Id** | `memory-topology` |
| **Panel / component** | `MemoryTopologyPanel` → `src/ui/StatsAside/MemoryTopologyPanel/` |
| **Capability** | `memoryDiagram` |
| **Phase** | M2 |
| **Unification** | `adapt-mapper` (compute); emulate uses this chrome as interim [arch-diagram](arch-diagram.md) stand-in |
| **Sept 30 (emulate)** | **interim chrome** — data via `archDiagram`; **UI title** = 内存负载分析 (same as compute) |

## Sketches

![Memory load / topology chrome](../ui/source/v930/report-stats-scrolled.jpeg)

**Component crops:** ![Memory topology](../../src/ui/StatsAside/MemoryTopologyPanel/visual/memory-topology.png) · ![Buffer links](../../src/ui/StatsAside/MemoryTopologyPanel/visual/buffer-links.png)

## Purpose

Fixed memory-path chrome with data-driven edge labels (BW / hit rate) for the selected block.

## View-model

| Field | Role | Required? |
|-------|------|-----------|
| `reportModel.memoryTopology` | Nodes + edges with labels | **Required to show** |
| capability `memoryDiagram` | Feature gate | Set when topology present |

## Hide rule

No drawable labels / L2 plate → hide diagram ([DATA-30](../context/decisions/DATA.md), PR-VM-018).

## Compute fill

| Adapted field | Embed | Columns / notes | Schema SSOT |
|---------------|-------|-----------------|-------------|
| `memoryTopology` | `Memory.csv`, `MemoryL0.csv`, `MemoryUB.csv`, `L2Cache.csv` | Edge / plate map below; `buildMemoryTopology` | [METRICS](../formats/compute/METRICS_AND_TRACE.md), [compute/FORMAT](../formats/compute/FORMAT.md) |

The panel renders the official chrome [`memory-topology.svg`](../../src/ui/StatsAside/MemoryTopologyPanel/memory-topology.svg) and overlays **real values** on that chrome's value slots — the `summary.jsonl` category mean under `All`, that block's CSV row when a `block_id` is picked ([DATA-19](../context/decisions/DATA.md) / [DATA-29](../context/decisions/DATA.md)).

<a id="edge-field-source"></a>

### Edge → field → source

Use this table for `MemoryTopologyPanel` labels. Bare `*_read_bw` = leaving the named resource; `*_write_bw` = arriving there.

| Display edge | Field | Source | Notes |
| --- | --- | --- | --- |
| GM → L2 | `aic_main_mem_read_bw(GB/s)` + `aiv_main_mem_read_bw(GB/s)` | `Memory.csv` | **DATA-40 (resolved):** the producer's **"Main Read"** — both sides **summed**, the same quantity the 带宽利用率 读 card shows (DATA-8). Read = leaving GM (`out.rep` 16.89, aiv-only there). A side that is `NA` contributes nothing; both `NA` → no label |
| GM ← L2 | `aic_main_mem_write_bw(GB/s)` + `aiv_main_mem_write_bw(GB/s)` | `Memory.csv` | **DATA-40 (resolved):** **"Main Write"**, likewise summed. Write = arriving at GM (≡ `aiv_ub_to_gm_bw`). The producer's row 32 lists the AIC **read** column by slip; the card's `aicore_gm_write_bw` side is the write column |
| L2 → L1 | `aiv_gm_to_ub_bw(GB/s)` | `Memory.csv` | **DATA-43 (resolved):** the plate is the producer's DATA-39 row `24` `GM -> UB` field, painted on the chrome's own AIC-row corridor slot ("display it according to svg spec"). `aic_l1_read_bw` therefore feeds **no** plate; it stays a Memory.csv 详情 column. `out.rep` NA |
| L2 ← L1 | `aic_l1_write_bw(GB/s)` | `Memory.csv` | Adapter edge exists; **diagram slot blank** pending UI-48 (export routes this corridor onto FixP) |
| L1 → L0A | `aic_l0a_read_bw(GB/s)` | `MemoryL0.csv` | Keep master L1→L0A (operand buffer); `out.rep` NA |
| L1 → L0B | `aic_l0b_read_bw(GB/s)` | `MemoryL0.csv` | Same |
| L0A → Cube | `aic_l0a_write_bw(GB/s)` | `MemoryL0.csv` | Same |
| L0B → Cube | `aic_l0b_write_bw(GB/s)` | `MemoryL0.csv` | Same |
| L0C → Cube | `aic_l0c_read_bw_cube(GB/s)` | `MemoryL0.csv` | |
| Cube → L0C | `aic_l0c_write_bw_cube(GB/s)` | `MemoryL0.csv` | |
| L0C → L1 | `L0C_to_L1_datas(KB)` | `Memory.csv` | **DATA-24:** Product-confirmed field. No 理论值 (Peak %) field exists — the producer's DATA-39 row `23` is `NA` ([DATA-41](../context/questions/DATA.md)) |
| L0C → L2 | `L0C_to_GM_datas(KB)` | `Memory.csv` | **DATA-25:** Product-confirmed field. No 理论值 (Peak %) field exists ([DATA-41](../context/questions/DATA.md)) |
| UB → L2 | `aiv_ub_to_gm_bw(GB/s)` | `Memory.csv` | **DATA-22:** Product answer; `MemoryUB.csv` `aiv_ub_read_bw_gm` is not the collected field |
| L2 → UB | `aiv_gm_to_ub_bw(GB/s)` | `Memory.csv` | **DATA-23:** Product answer; `MemoryUB.csv` `aiv_ub_write_bw_gm` is not the collected field |
| Vec → UB | `aiv_ub_write_bw_vector(GB/s)` | `MemoryUB.csv` | `ub_read_*` = leaving UB (`out.rep` add 2:1) |
| UB → Vec | `aiv_ub_read_bw_vector(GB/s)` | `MemoryUB.csv` | |
| L2Cache Hit Rate | total `*_hit_rate(%)` | `L2Cache.csv` / `summary.jsonl` `L2Cache` | **DATA-21:** use the **total** hit rate; fall back to first non-`NA` of `aic_total_hit_rate(%)`, `aiv_total_hit_rate(%)`, then read rates |
| **L2 Peak(%)** | same hit-rate columns as above | `L2Cache.csv` | **DATA-20 (resolved):** L2 box only = hit rate, its 100% reference is the hit rate itself (not a peak-relative percent) |
| **Scalar util (in-box)** | `aiv_scalar_ratio` | `PipeUtilization.csv` / `summary.jsonl` `PipeUtilization` | **UI-49 (resolved):** printed `{ratio × 100}%` (DATA-28 own-busy-time ratio, not a peak-relative percent) in the AIV0 **and** AIV1 `Scalar` boxes — one field, one value, both rows |
| **Vec util (in-box)** | `aiv_vec_ratio` | `PipeUtilization.csv` / `summary.jsonl` `PipeUtilization` | **UI-49 (resolved):** `{ratio × 100}%` in the AIV0 **and** AIV1 `Vec` boxes |
| **Cube util (in-box)** | `aic_cube_ratio` | `PipeUtilization.csv` / `summary.jsonl` `PipeUtilization` | **UI-49 (resolved):** `{ratio × 100}%` in the AIC `Cube` box |
| AIC `Scalar`, AIV0/AIV1 `SIMT VF`, AIV0/AIV1 `SIMD VF`, `FixP` (in-box) | — | — | **UI-49 (resolved):** the producer's DATA-39 table marks all six rows **`NA`**, but its `SIMD VF` rows name the `Vec` position the `Vec` rows paint — so the remaining **four** positions have no field and nothing is drawn |

**NA (confirmed):** do not show `NA` labels; **do show 0**. Edge thickness stays static.

<a id="visualization-logic"></a>

### Visualization logic

- Static architecture template: GM/HBM → L2 → AIC (L1, L0A/B/C, Cube, FixP, Scalar) and AIV×2 (UB, Vec/SIMT/SIMD, Scalar).
- Overlay **GB/s** (or KB) on edges from the mapping table. Hide `NA`; show `0`.
- Overlay **Peak (%)** on the **L2** unit as `{n}%` under **L2 Cache** (hit rate, DATA-20; sketch has no “Peak” word and no fill tint). **No other unit** carries a Peak(%): the export has no peak plate for one and the adapter no field ([DATA-20](../context/decisions/DATA.md)). The other in-box badges the sketch draws are **unit utilizations**, not peaks — AIV0/AIV1 **Scalar** and **Vec**, AIC **Cube** — printed `{ratio × 100}%` from `PipeUtilization` ([UI-49](../context/decisions/UI.md)); the four field-less positions stay blank.
- **Right-click (UI-35):** open memory CSV overlay (Memory / L2Cache / MemoryUB / MemoryL0), same as **详情**.
- Labels are **block-scoped** via the same block switcher as memory details ([DATA-19](../context/decisions/DATA.md)).

Component ACs that also own these rules: [MemoryTopologyPanel.spec.md](../../src/ui/StatsAside/MemoryTopologyPanel/MemoryTopologyPanel.spec.md).

## Emulate fill (interim Architecture Diagram stand-in)

| Adapted field | Embed | Columns / notes | Status |
|---------------|-------|-----------------|--------|
| `memoryTopology` (VM carrier) | `ArchDiagramMetrics.csv` | Parameter→slot map on [arch-diagram](arch-diagram.md#parameter-slot-map) ([DATA-48a](../context/decisions/interim/DATA.md)) | `adapt-mapper` |
| Heatmap | `MemoryRWAccesses.csv` | biprof §11.2.3.2 | **out** Sept 30 ([DATA-49](../context/questions/DATA.md)) |

## Adapter

| Profile | Entry | Notes |
|---------|-------|-------|
| compute | `buildMemoryTopology` / `firstLabelledMemoryTopology` | Capability `memoryDiagram` |
| emulate | `topologyFromArchDiagramMetrics` in `adaptEmulate` | Capability **`archDiagram`**; interim use of this chrome |

## Related

- Spec: [MemoryTopologyPanel.spec.md](../../src/ui/StatsAside/MemoryTopologyPanel/MemoryTopologyPanel.spec.md)
- Product: compute §11.2.6; emulate Architecture Diagram §11.2.3.1 ([arch-diagram](arch-diagram.md)); heatmap §11.2.3.2 out Sept 30
- Catalog: [README](README.md)
