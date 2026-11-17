# `ResourceConflictRatio.csv`

Shared grain columns (`block_id`, `sub_block_id`, `aic_time(us)`, `aic_total_cycles`, `aiv_time(us)`, `aiv_total_cycles`) are defined in [SCHEMA.md](SCHEMA.md) § Metric CSVs.

## UI / sample notes

Producer columns: [SCHEMA.md](SCHEMA.md). Sample columns: AIC wait ratios (`aic_cube_wait_ratio`, `aic_mte*_wait_ratio`) and AIV conflict/wait ratios (`aiv_vec_*_cflt_ratio`, `aiv_mte*_wait_ratio`).

---

## Schema

| Column | Meaning |
| --- | --- |
| `aic_cube_wait_ratio` | Cycles Cube spent blocked / all instruction cycles. |
| `aic_mte1_wait_ratio` | Cycles MTE1 spent blocked / all instruction cycles. |
| `aic_mte2_wait_ratio` | Cycles MTE2 spent blocked / all instruction cycles. |
| `aic_mte3_wait_ratio` | Cycles MTE3 spent blocked / all instruction cycles. |
| `aiv_vec_stu_cflt_ratio` | Cycles blocked on a Vector set (store) / all instruction cycles. |
| `aiv_vec_ldu_cflt_ratio` | Cycles blocked on a Vector load / all instruction cycles. |
| `aiv_vec_sfu_cflt_ratio` | Cycles blocked on a Vector read/write conflict / all instruction cycles. |
| `aiv_vec_wait_ratio` | Cycles the Vector unit spent blocked / all instruction cycles. |
| `aiv_mte2_wait_ratio` | Cycles MTE2 spent blocked / all instruction cycles. |
| `aiv_mte3_wait_ratio` | Cycles MTE3 spent blocked / all instruction cycles. |

Hints H06–H10 cite `aiv_vec_total_cflt_ratio`, `aiv_vec_bankgroup_cflt_ratio`, `aiv_vec_bank_cflt_ratio`, `aiv_vec_resc_cflt_ratio`, and `aiv_vec_mte_cflt_ratio`. Those names are not in this PDF table.
