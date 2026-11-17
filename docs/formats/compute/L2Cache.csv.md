# `L2Cache.csv`

Shared grain columns (`block_id`, `sub_block_id`, `aic_time(us)`, `aic_total_cycles`, `aiv_time(us)`, `aiv_total_cycles`) are defined in [SCHEMA.md](SCHEMA.md) § Metric CSVs.

## UI / sample notes

Docx maps「L2Cache Hit Rate」to this file without listing columns. Sample columns:

| Prefix | Hit / miss metrics |
| --- | --- |
| `aic_*` | write/read cache hit & miss-allocate, `aic_write_hit_rate(%)`, `aic_read_hit_rate(%)`, `aic_total_hit_rate(%)` |
| `aiv_*` | same pattern for vector |

Use read/write (or total) hit rate on the GM↔L2 link in the memory diagram (per annotated mockup).

## Schema

| Column | Meaning |
| --- | --- |
| `ai*_read_close_hit` | Read hits in close cache. |
| `ai*_read_close_miss` | Read misses in close cache. |
| `ai*_read_close_victim` | Read victims (evictions) in close cache. |
| `ai*_read_far_hit` | Read hits in far cache. |
| `ai*_read_far_miss` | Read misses in far cache. |
| `ai*_read_far_victim` | Read victims in far cache. |
| `ai*_read_hit_rate(%)` | Read-cache hit rate. |
| `ai*_write_close_hit` | Write hits in close cache. |
| `ai*_write_close_miss` | Write misses in close cache. |
| `ai*_write_close_victim` | Write victims in close cache. |
| `ai*_write_far_hit` | Write hits in far cache. |
| `ai*_write_far_miss` | Write misses in far cache. |
| `ai*_write_far_victim` | Write victims in far cache. |
| `ai*_write_hit_rate(%)` | Write-cache hit rate. |

Hint H05 cites `ai*_total_hit_rate(%)`. That name is not in this PDF table. The classic sample does have `aic_total_hit_rate(%)` / `aiv_total_hit_rate(%)` (see UI / sample notes above).
