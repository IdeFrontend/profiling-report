# `summary.jsonl`

Embed basename is looked up case-insensitively (`summary.jsonl` / `Summary.jsonl` / `SUMMARY.jsonl` — see `payloadByName` in `adaptRep.ts`). This file uses the gather_2d pack spelling **`summary.jsonl`**; the product PDF / SCHEMA heading spells `Summary.jsonl`. Same section — do **not** add a second markdown file for the capital-S spelling.

## Schema

JSONL. `category` selects the object.

### `OpInfoSummary`

§11.6.2. Same identity keys as `OpBasicInfo.csv`. The example spells `Device Id` and `Pid` (not `Device ID` / `PID`). `Current Freq` and `Rated Freq` are the frequency keys. Derived keys in the example:

| Key | Meaning |
| --- | --- |
| `aicore_parallel_utilization` | AI Core parallel utilization. |
| `aicore_parallel_balance` | AI Core load balance. |
| `aicore_gm_bw_theoretical(GB/s)` | Theoretical GM bandwidth. Example `1600`. |
| `aicore_gm_read_bw(GB/s)` | GM read bandwidth. |
| `aicore_gm_write_bw(GB/s)` | GM write bandwidth. |
| `aicore_gm_bw_usage_rate(%)` | GM bandwidth utilization. |
| `communication_time` | 通信时间 (communication time), microseconds. |
| `compute_overhead_time` | 头开销时间 (overhead time), microseconds. |
| `compute_communication_overlap_time` | 通算重叠时间 (compute–communication overlap), microseconds. Tooltip only; not a bar segment. |

There is no `compute_time` key. 计算时间 (compute time) is `Task Duration(us) − communication_time − compute_overhead_time`, clamped at 0, so the three bar segments sum to the card total. `null` or a missing key on either bar source means the breakdown was not collected. The card total prefers `OpBasicInfo.csv` `Task Duration(us)` when that row exists.

This example does not include the FLOPS keys the viewer already reads (`aic_flops` and the related theoretical fields). It does not withdraw them.

### `Roofline`

§11.8. One object, `category` `"Roofline"`. Each series key holds `p_peak`, `b_peak`, `w`, `t`, `q`. The viewer reads this category for measured points and roofs. A `HardwareInfo.jsonl` `Roofline` line wins when both files have one.

Series keys in the example: `aiv_simd_b8`, `aiv_simt_b8`, `aiv_simd_b16`, `aiv_simt_b16`, `aiv_simd_b32`, `aiv_simt_b32`, `aic_b8`, `aic_b16`, `aic_b32`. `b8` / `b16` / `b32` are the 8 / 16 / 32-bit widths. `simd` and `simt` are the Vector execution modes.

`p_peak` formula (frequency in MHz; the prose says the result is TFLOPS). `cube_num` / `vector_num` are the core counts. The factor `2` is multiply-add for Cube (one beat is a 16×16×16 multiply) and dual-issue for Vector (one beat is 128 fp16 adds, or 64 fp32 / int32 adds).

| Unit | Dtype | Formula |
| --- | --- | --- |
| cube | fp16 / bf16 | `cube_num × 4096 × 2 × frequency / 1000` |
| cube | tf32 / hf32 | `cube_num × 2048 × 2 × frequency / 1000` |
| cube | int8 / fp8 | `cube_num × 8192 × 2 × frequency / 1000` |
| vector | fp16 / bf16 | `vector_num × 128 × 2 × frequency / 1000` |
| vector | fp32 | `vector_num × 64 × 2 × frequency / 1000` |
| vector | int32 | `vector_num × 64 × 2 × frequency / 1000` |

`b_peak` in the prose is the spec maximum bandwidth, 1.6 TB/s. The example stores `1600` or `800`. Plotting treats `b_peak` as GB/s: `B = b_peak × 10^9` bytes/s.

Arithmetic intensity `I = w / q`. Achieved performance `P = w / t`. The roof is `min(p_peak, b_peak × I)`. Every example point satisfies `P ≤ p_peak` and `q / t ≤ B`. The Vector example is memory-bound; the Cube example is compute-bound.

`q` is collected by instruction instrumentation. The PDF sentence stops there. `w` and `t` are the series fields; the PDF does not give them a separate collection sentence.

Example `p_peak` values are integers of order 10^13–10^14, not small TFLOPS quantities. Use the number in the file.

### `PerformanceHints`

§11.10. `{"category":"PerformanceHints", "hints": [ "<string>", ... ]}`. Each string is the hint text. The check table:

| ID | Check | Condition | Hint |
| --- | --- | --- | --- |
| H01 | Vector compute | `aiv_vec_ratio > 0.50` and `aiv_vec_ratio == max(S_AIV)` | Inspect the Vector instruction sequence, redundant compute, conversions, and reductions. If H07 or H08 also hits, inspect that conflict first. |
| H02 | Scalar overhead | On that core, `aic_scalar_ratio > 0.30` or `aiv_scalar_ratio > 0.30` | Inspect address math, parameter rebuild, branches, and loop-invariant code inside the loop. Changing the core count needs a separate experiment. |
| H03 | MTE2 inbound | Vector: `aiv_mte2_ratio > 0.50` and it equals `max(S_AIV)`. Cube: `aic_mte2_ratio` against `S_AIC`. | Enter the inbound-copy analysis. Combine with H04 / H05 for granularity and reuse. Do not declare bandwidth saturation from this hit alone. |
| H04 | Average copy size | Vector: `N = aiv_mte2_instructions`, `N > 0`, and `D_bytes / N < 16384`. `D_bytes` is `GM_to_UB_datas(KB)` converted to bytes. | Average bytes per copy instruction is under 16 KiB. Check whether adjacent copies can merge, and whether accesses are contiguous. |
| H05 | L2 reuse | `ai*_total_hit_rate(%) < 50` | Check repeated access, order, working set, and cache policy. A low hit rate is not a defect when the data is not supposed to be reused. |
| H06 | Vector conflict total | `aiv_vec_total_cflt_ratio > 0.05`. `> 0.15` is "重点检查" (inspect first). | Read the specific conflict fields. Do not treat the total as a bank conflict. |
| H07 | Bank-group conflict | `aiv_vec_bankgroup_cflt_ratio > 0.03` | Check block stride, repeat stride, and UB layout. |
| H08 | Bank conflict | `aiv_vec_bank_cflt_ratio > 0.03` | Check operand addresses and padding for the target architecture. |
| H09 | Execution-resource conflict | `aiv_vec_resc_cflt_ratio > 0.05` | Check instruction competition for execution resources and issue order. |
| H10 | Vector–MTE conflict | `aiv_vec_mte_cflt_ratio > 0.03` | Check Vector and MTE access timing and shared-resource contention. |
| H11 | Instruction cache | `ai*_icache_miss_rate > 0.15` | Check code size, unroll, and template branches, and confirm with instruction-wait info. |
| H12 | Cross-core duration spread | `I = (max(t_i) − min(t_i)) / max(t_i)`. `0.10 ≤ I < 0.30` triggers a check. `I ≥ 0.30` is "重点检查". | Check task split, tail blocks, and per-core work. A duration spread does not by itself prove a bad split. |

`S_AIV` / `S_AIC` are the set of that side's pipe ratios. `t_i` is per-core duration. The PDF's source column is `R1` / `R2` (and combinations); it does not define those ids further.
