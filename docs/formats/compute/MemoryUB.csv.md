# `MemoryUB.csv`

Shared grain columns (`block_id`, `sub_block_id`, `aic_time(us)`, `aic_total_cycles`, `aiv_time(us)`, `aiv_total_cycles`) are defined in [SCHEMA.md](SCHEMA.md) § Metric CSVs.

## UI / sample notes

| Docx display edge | Docx field | Sample column | Status |
| --- | --- | --- | --- |
| Vec → UB | `aiv_ub_write_bw_vector(GB/s)` | `aiv_ub_write_bw_vector(GB/s)` | Present; `ub_read_*` = leaving UB |
| UB → Vec | `aiv_ub_read_bw_vector(GB/s)` | `aiv_ub_read_bw_vector(GB/s)` | Present |
| UB → L2 | `aiv_ub_read_bw_gm(GB/s)` | — | Product name on `MemoryUB.csv` (unverified; absent from sample); sample uses `aiv_ub_to_gm_bw` on `Memory.csv` |
| L2 → UB | `aiv_ub_write_bw_gm(GB/s)` | — | Same: product `MemoryUB.csv` unverified; sample `aiv_gm_to_ub_bw` on `Memory.csv` |

The PDF glosses both `aiv_ub_read_bw_gm` and `aiv_ub_write_bw_gm` as GM→UB ([SCHEMA.md](SCHEMA.md)). These edges keep the name-based directions (`ub_read_*` = leaving UB).

Sample also includes `aiv_ub_read_bw_scalar(GB/s)` / `aiv_ub_write_bw_scalar(GB/s)`.

## Schema

| Column | Meaning |
| --- | --- |
| `aiv_ub_read_bw_vector(GB/s)` | Bandwidth of Vector reads from UB, over total cycles. |
| `aiv_ub_write_bw_vector(GB/s)` | Bandwidth of Vector writes to UB, over total cycles. |
| `aiv_ub_write_bw_gm(GB/s)` | PDF text: bandwidth of GM → UB writes, over total cycles. |
| `aiv_ub_read_bw_gm(GB/s)` | PDF text: bandwidth of GM → UB reads, over total cycles. |

The two `*_bw_gm` sentences both say GM → UB. They differ only by 写入 (write) versus 读取 (read). The column name is the identifier; the sentence is the PDF's gloss.
