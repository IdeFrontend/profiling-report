# `Memory.csv`

Shared grain columns (`block_id`, `sub_block_id`, `aic_time(us)`, `aic_total_cycles`, `aiv_time(us)`, `aiv_total_cycles`) are defined in [SCHEMA.md](SCHEMA.md) § Metric CSVs.

## UI / sample notes

GM / L2 / L1 oriented bandwidth and data volumes. Bare `*_read_bw` = leaving the named resource; `*_write_bw` = arriving there (same rule as UB: `ub_read_*` = leaving UB).

| Docx display edge | Docx field | Sample column | Status |
| --- | --- | --- | --- |
| GM → L2 | `ai*_main_mem_read_bw` | `aic_main_mem_read_bw(GB/s)`, `aiv_main_mem_read_bw(GB/s)` | Present; read = leaving GM (`out.rep` 16.89 tracks `gm_to_ub`) |
| GM ← L2 | `ai*_main_mem_write_bw` | `aic_main_mem_write_bw(GB/s)`, `aiv_main_mem_write_bw(GB/s)` | Present; write = arriving at GM (≡ `aiv_ub_to_gm_bw`) |
| L2 → L1 | `aic_l1_read_bw(GB/s)` | `aic_l1_read_bw(GB/s)` | **Confirmed** on `Memory.csv`; no `MemoryL1.csv`; `out.rep` NA |
| L2 ← L1 | `aic_l1_write_bw(GB/s)` | `aic_l1_write_bw(GB/s)` | **Confirmed**; `out.rep` NA |
| L0C → L1 | `L0C_to_L1_datas` | `L0C_to_L1_datas(KB)` (+ usage rate) | Present in sample; marked 待确定 in docx |
| L0C → L2 / GM | `L0C_to_GM_datas` | `L0C_to_GM_datas(KB)` (+ usage rate) | Present in sample; marked 待确定 in docx |
| L0C → UB | — | — | **TBD** (docx); absent in sample |

Also present in sample (not all listed in docx edge table): MTE instruction/ratio columns, `GM_to_L1_*`, `UB_to_GM_*`, `aiv_ub_to_gm_bw(GB/s)`, `aiv_gm_to_ub_bw(GB/s)`, etc.

## Schema

| Column | Meaning |
| --- | --- |
| `aiv_ub_to_gm_bw(GB/s)` | Bandwidth of UB → GM writes over total cycles. |
| `aiv_gm_to_ub_bw(GB/s)` | Bandwidth of GM → UB writes over total cycles. |
| `aic_l1_read_bw(GB/s)` | Bandwidth while L1 reads every other unit, over total cycles. |
| `aic_l1_write_bw(GB/s)` | Bandwidth while L1 writes every other unit, over total cycles. |
| `ai*_main_mem_read_bw(GB/s)` | Bandwidth while main memory reads every other unit, over total cycles. |
| `ai*_main_mem_write_bw(GB/s)` | Bandwidth while main memory writes every other unit, over total cycles. |
| `aic_mte1_instructions` | MTE1 instruction count. |
| `aic_mte1_ratio` | MTE1 cycles / total cycles. |
| `ai*_mte2_instructions` | MTE2 instruction count. |
| `ai*_mte2_ratio` | MTE2 cycles / total cycles. |
| `ai*_mte3_instructions` | MTE3 instruction count. |
| `ai*_mte3_ratio` | MTE3 cycles / total cycles. |
| `read_main_memory_datas(KB)` | Bytes read from main memory. |
| `write_main_memory_datas(KB)` | Bytes written to main memory. |
| `GM_to_L1_datas(KB)` | GM → L1 volume. |
| `L0C_to_L1_datas(KB)` | L0C → L1 volume. |
| `L0C_to_GM_datas(KB)` | L0C → GM volume. |
| `GM_to_UB_datas(KB)` | GM → UB volume. |
| `UB_to_GM_datas(KB)` | UB → GM volume. |
| `GM_to_L1_bw_usage_rate(%)` | GM → L1 bandwidth utilization. |
| `L0C_to_L1_bw_usage_rate(%)` | L0C → L1 bandwidth utilization. |
| `L0C_to_GM_bw_usage_rate(%)` | L0C → GM bandwidth utilization. |
| `GM_to_UB_bw_usage_rate(%)` | GM → UB bandwidth utilization. |
| `UB_to_GM_bw_usage_rate(%)` | UB → GM bandwidth utilization. |
