# `PipeUtilization.csv`

Shared grain columns (`block_id`, `sub_block_id`, `aic_time(us)`, `aic_total_cycles`, `aiv_time(us)`, `aiv_total_cycles`) are defined in [SCHEMA.md](SCHEMA.md) § Metric CSVs.

## UI / sample notes

Primary source for pipe occupancy (Cube / Vector) and several Roofline tab fields in the docx.

**Cube-side (AIC) fields used by UI:**

| Field | Used as |
| --- | --- |
| `aic_cube_ratio` | Cube bar / Roofline「内存单元」 |
| `aic_mte2_ratio` | MTE2 / Roofline「内存通路」 |
| `aic_mte1_ratio` | MTE1 / Roofline「搬运单元」 |
| `aic_fixpipe_ratio` | FIXP |
| `aic_scalar_ratio` | Scalar |
| `aic_icache_miss_rate` | ICache Miss |
| `aic_*_time(us)` | Absolute times in details list |
| `aic_total_cycles` | Cycles in details |
| `aic_mte3_*`, `aic_fixpipe_active_bw(GB/s)`, stall times | Details list |

**Vector-side (AIV) fields used by UI:**

| Field | Used as |
| --- | --- |
| `aiv_vec_ratio` | Vector |
| `aiv_mte2_ratio` | MTE2 |
| `aiv_mte3_ratio` | MTE3 |
| `aiv_scalar_ratio` | Scalar |
| `aiv_icache_miss_rate` | ICache Miss |
| `aiv_*_time(us)`, bandwidths, stall times | Details list |

Full sample header also includes dual/single scalar times and wait/stall breakdowns; show in the pipe **详情** key-value list (docx detail table was empty).

## Schema

| Column | Meaning |
| --- | --- |
| `aiv_vec_time(us)` | Vector-instruction time. |
| `aiv_vec_ratio` | Vector-instruction cycles / total cycles. |
| `aic_cube_time(us)` | Cube-instruction time (fp16 and s16 matrix ops). |
| `aic_cube_ratio` | Cube-instruction cycles / total cycles. |
| `ai*_scalar_time(us)` | Scalar-instruction time. |
| `ai*_scalar_ratio` | Scalar-instruction cycles / total cycles. |
| `aic_fixpipe_time(us)` | Fixpipe time (L0C → GM / L1). |
| `aic_fixpipe_ratio` | Fixpipe cycles / total cycles. |
| `aic_mte1_time(us)` | MTE1 time (L1 → L0A / L0B), excluding wait. |
| `aic_mte1_ratio` | MTE1 cycles / total cycles. |
| `ai*_mte2_time(us)` | MTE2 time (GM → AI Core). |
| `ai*_mte2_ratio` | MTE2 cycles / total cycles. |
| `ai*_mte3_time(us)` | MTE3 time (AI Core → GM). |
| `ai*_mte3_ratio` | MTE3 cycles / total cycles. |
| `ai*_icache_miss_rate` | L1 instruction-cache miss rate. Lower is better. |
| `aic_mte3_active_bw(GB/s)` | Active bandwidth of Cube MTE3 (AI Core → DDR). |
| `aiv_mte3_active_bw(GB/s)` | Active bandwidth of Vector MTE3 (AI Core → DDR). |
| `aic_fixpipe_active_bw(GB/s)` | Active bandwidth of fixpipe (L0C → OUT / L1). |
| `aiv_mte2_active_bw(GB/s)` | Active bandwidth of Vector MTE2 (DDR → AI Core). |
| `aic_mte1_active_bw(GB/s)` | Active bandwidth of Cube MTE1 (L1 → L0A and L1 → L0B). |
| `aic_mte2_active_bw(GB/s)` | Active bandwidth of Cube MTE2 (GM → L1, GM → L0A, GM → L0B). |
