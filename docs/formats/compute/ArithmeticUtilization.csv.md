# `ArithmeticUtilization.csv`

Shared grain columns (`block_id`, `sub_block_id`, `aic_time(us)`, `aic_total_cycles`, `aiv_time(us)`, `aiv_total_cycles`) are defined in [SCHEMA.md](SCHEMA.md) § Metric CSVs.

## UI / sample notes

Producer columns: [SCHEMA.md](SCHEMA.md). The PDF names `aic_cube_fp_ratio` / `aic_cube_int_ratio` and `aiv_vec_vf_ratio` / `aiv_vec_sfu_ratio` / `aiv_vec_simt_vf_ratio`. The classic sample uses dtype-specific names and supports Roofline composition labels such as `Vec_FP32` / `Vec_MISC`:

- AIC: `aic_cube_ratio`, `aic_cube_fp16_ratio`, `aic_cube_int8_ratio`, FOPs / instruction counts
- AIV: `aiv_vec_ratio`, `aiv_vec_fp32_ratio`, `aiv_vec_fp16_ratio`, `aiv_vec_int32_ratio`, `aiv_vec_int16_ratio`, `aiv_vec_misc_ratio`, `aiv_vec_fops`

## Schema

| Column | Meaning |
| --- | --- |
| `aic_cube_ratio` | Cube-instruction cycles / total cycles. |
| `aic_cube_fp_ratio` | Cube floating-point instruction cycles / total cycles. |
| `aic_cube_int_ratio` | Cube integer instruction cycles / total cycles. |
| `aic_cube_total_instr_number` | Cube instruction count (fp + int). |
| `aic_cube_fp_instr_number` | Cube fp instruction count. |
| `aic_cube_int_instr_number` | Cube int instruction count. |
| `aiv_vec_ratio` | Vector-instruction cycles / total cycles. |
| `aiv_vec_vf_ratio` | Vector VF instruction cycles / total cycles. |
| `aiv_vec_sfu_ratio` | Vector SFU instruction cycles / total cycles. |
| `aiv_vec_simt_vf_ratio` | Vector SIMT VF instruction cycles / total cycles. |

Classic `out.rep` uses dtype-specific names (`aic_cube_fp16_ratio`, `aiv_vec_fp32_ratio`, …) instead of the `fp` / `int` / `vf` / `sfu` / `simt_vf` names in this table. Those sample names are listed above under UI / sample notes.
