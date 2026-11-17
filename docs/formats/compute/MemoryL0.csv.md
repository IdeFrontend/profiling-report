# `MemoryL0.csv`

Shared grain columns (`block_id`, `sub_block_id`, `aic_time(us)`, `aic_total_cycles`, `aiv_time(us)`, `aiv_total_cycles`) are defined in [SCHEMA.md](SCHEMA.md) § Metric CSVs.

## UI / sample notes

L0C `_bw_cube` directions are confirmed by suffix. L0A/L0B keep master L1→buffer→Cube; `out.rep` is NA.

| Docx display edge | Field | Sample |
| --- | --- | --- |
| L1 → L0A | `aic_l0a_read_bw(GB/s)` | yes |
| L1 → L0B | `aic_l0b_read_bw(GB/s)` | yes |
| L0A → Cube | `aic_l0a_write_bw(GB/s)` | yes |
| L0B → Cube | `aic_l0b_write_bw(GB/s)` | yes |
| L0C → Cube | `aic_l0c_read_bw_cube(GB/s)` | yes (docx: 待确定 source, listed as MemoryL0) |
| Cube → L0C | `aic_l0c_write_bw_cube(GB/s)` | yes |

## Schema

| Column | Meaning |
| --- | --- |
| `aic_l0a_read_bw(GB/s)` | Bandwidth while L0A reads every other unit, over total cycles. |
| `aic_l0a_write_bw(GB/s)` | Bandwidth while L0A writes every other unit, over total cycles. |
| `aic_l0b_read_bw(GB/s)` | Bandwidth while L0B reads every other unit, over total cycles. |
| `aic_l0b_write_bw(GB/s)` | Bandwidth while L0B writes every other unit, over total cycles. |
| `aic_l0c_read_bw_cube(GB/s)` | Bandwidth of Cube reads from L0C, over total cycles. |
| `aic_l0c_write_bw_cube(GB/s)` | Bandwidth of Cube writes to L0C, over total cycles. |
