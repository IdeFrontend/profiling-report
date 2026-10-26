# Compute data schema

**Profile:** `compute` (npu-compute).

Producer field catalog from the product PDF *npu-compute性能优化* (性能优化 / performance optimization), export **qLDqqw**, 2026-10-23, §11.1.3.8–§11.10. Identifiers the PDF wraps at `_` are rejoined. UI fill and sample cross-checks stay in [FORMAT.md](FORMAT.md) and [METRICS_AND_TRACE.md](METRICS_AND_TRACE.md). Container detection: [formats README](../README.md).

`ai*` in a column name is the PDF's shorthand for the pair `aic_*` and `aiv_*` (Cube and Vector). Units are in the column suffix: `(us)` microseconds, `(GB/s)` gigabytes per second, `(KB)` kilobytes, `(%)` percent. Ratio columns with no suffix are a share of total cycles (0–1). Missing metric cells in samples are the literal `NA`.

## Container head

§11.1.3.8. Little-endian, packed. `NpuRepHead` then `fileInfoCount` × `NpuRepFileInfo`, then payload bytes.

### `NpuRepHead`

| Field | Bytes | Meaning |
| --- | --- | --- |
| `magic` | 8 | Magic, `npu-rep` + NUL (`npu-rep\0`) |
| `version` | 4 | High 16 bits major, next 8 minor, low 8 patch |
| `origin` | 2 | `1` compute, `2` simulator, `3` sanitizer ([PROC-9](../../context/decisions/PROC.md)) |
| `repHeadLength` | 2 | `sizeof(NpuRepHead)` |
| `fileInfoCount` | 4 | Number of file-info records |
| `fileInfoLength` | 4 | Size of one `NpuRepFileInfo` |
| `resv1` | 4 | Alignment padding |
| `npuRepLength` | 8 | Total file length |

`parseNpuRep160` still accepts only `origin = 1` and throws on any other value. Simulator leaves are recognized by `manifest.json` ([PROC-8](../../context/decisions/PROC.md)), not by `origin`.

### `NpuRepFileInfo`

| Field | Bytes | Meaning |
| --- | --- | --- |
| `magic` | 8 | `npu-rep` + NUL (`npu-rep\0`) |
| `fileName` | 128 | Name, including a trailing NUL. Example `"kernel0"` |
| `fileType` | 2 | See below |
| `resv0` | 2 | Alignment, `0` |
| `resv1` | 4 | Alignment |
| `fileLength` | 8 | Payload length |
| `fileRepOffset` | 8 | Payload offset from the start of the report |

PDF `fileType`: `1` npu-rep, `2` json, `3` jsonl, `4` csv, `5` sqlite3, `6` txt.

The viewer parser's numbering for current packs is different at the end: `6` protobuf, `7` txt (`objdump.txt` / `.asc`). The hub type table is [formats README](../README.md) §3.5; behavior is [npu-rep](../../../specs/core/npu-rep.spec.md). Packs in this repo use the parser numbering.

## Metric CSVs

§11.1.3.8.2–§11.1.3.8.9. Each file is one row per block. These columns are on every file below:

| Column | Meaning |
| --- | --- |
| `block_id` | The PDF uses the same sentence as `Block Dim`: task split count, the core count configured for the task. ArithmeticUtilization's display name there is the typo "blcok id". On a metric row the viewer and the sample treat it as the block index within the kernel grid ([FORMAT.md](FORMAT.md) §3), not as a copy of `Block Dim`. |
| `sub_block_id` | ArithmeticUtilization: Vector or Cube core id on the block. Other files: each block's name and index. |
| `aic_time(us)` | Time on each AI Cube core after the task is placed there. |
| `aic_total_cycles` | Cycles on each AI Cube core. |
| `aiv_time(us)` | Time on each AI Vector core after the task is placed there. |
| `aiv_total_cycles` | Cycles on each AI Vector core. |

Tables below list only the columns that are not in that set.

### `ArithmeticUtilization.csv`

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

Classic `out.rep` uses dtype-specific names (`aic_cube_fp16_ratio`, `aiv_vec_fp32_ratio`, …) instead of the `fp` / `int` / `vf` / `sfu` / `simt_vf` names in this table. Those sample names stay in [FORMAT.md](FORMAT.md) §3.8.

### `L2Cache.csv`

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

Hint H05 cites `ai*_total_hit_rate(%)`. That name is not in this PDF table. The classic sample does have `aic_total_hit_rate(%)` / `aiv_total_hit_rate(%)` ([FORMAT.md](FORMAT.md) §3.7).

### `Memory.csv`

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

### `MemoryL0.csv`

| Column | Meaning |
| --- | --- |
| `aic_l0a_read_bw(GB/s)` | Bandwidth while L0A reads every other unit, over total cycles. |
| `aic_l0a_write_bw(GB/s)` | Bandwidth while L0A writes every other unit, over total cycles. |
| `aic_l0b_read_bw(GB/s)` | Bandwidth while L0B reads every other unit, over total cycles. |
| `aic_l0b_write_bw(GB/s)` | Bandwidth while L0B writes every other unit, over total cycles. |
| `aic_l0c_read_bw_cube(GB/s)` | Bandwidth of Cube reads from L0C, over total cycles. |
| `aic_l0c_write_bw_cube(GB/s)` | Bandwidth of Cube writes to L0C, over total cycles. |

### `MemoryUB.csv`

| Column | Meaning |
| --- | --- |
| `aiv_ub_read_bw_vector(GB/s)` | Bandwidth of Vector reads from UB, over total cycles. |
| `aiv_ub_write_bw_vector(GB/s)` | Bandwidth of Vector writes to UB, over total cycles. |
| `aiv_ub_write_bw_gm(GB/s)` | PDF text: bandwidth of GM → UB writes, over total cycles. |
| `aiv_ub_read_bw_gm(GB/s)` | PDF text: bandwidth of GM → UB reads, over total cycles. |

The two `*_bw_gm` sentences both say GM → UB. They differ only by 写入 (write) versus 读取 (read). The column name is the identifier; the sentence is the PDF's gloss.

### `PipeUtilization.csv`

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

### `ResourceConflictRatio.csv`

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

## `OpBasicInfo.csv`

One row per operator. §11.1.3.8.7.

| Column | Meaning |
| --- | --- |
| `Op Name` | Operator name. |
| `Op Type` | Operator type. |
| `Task Duration(us)` | Task duration in microseconds: schedule onto the AI processor, execute, and completion response. |
| `Block Dim` | Task split count; the logical core count the developer set. |
| `Mix Block Dim` | Vector-core count when the operator runs on Cube and Vector together. `Block Dim` is then the Cube count. `N/A` means not a Mix operator. PDF limits this to Atlas A3 train/infer, Atlas A2 train/infer, and Ascend 950. |
| `Device ID` | AI processor id at runtime. The classic sample header spells this `Device Id`. |
| `PID` | Process id. The classic sample header spells this `Pid`. |
| `Current Freq` | Current AI processor frequency. |
| `Rated Freq` | Rated AI processor frequency. |

## `HardwareInfo.jsonl`

§11.1.3.8.1. One JSON object per line, discriminated by `category`.

| `category` | Fields |
| --- | --- |
| `Host Info` | `cpu_physical_count`, `cpu_logical_count`, `memory_total_size_MB`, `disk_total_size_GB` |
| `Device Info` | `npu_count`, `chip_info`, `arch_info` |
| `CPU Information` | `control_cpu_count`, `ai_cpu_count`, `ai_cpu_frequency_MHZ` |
| `AI Core Information` | `ai_core_count`, `ai_cube_count`, `ai_vector_count`, `ai_core_frequency_MHZ` (array) |
| `Memory Information` | `hbm_total_MB`, `hbm_used_MB`, `hbm_frequency_MHZ` |

## `Summary.jsonl`

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

§11.8. One object, `category` `"Roofline"`. Each series key holds `p_peak`, `b_peak`, `w`, `t`, `q`.

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

## Communication-fusion timestamps

§11.6.1. msprof fields for a fused compute/communication operator. Times are event stamps, not the `OpInfoSummary` durations above.

| Field | Meaning |
| --- | --- |
| `waitNotifyStartTime` | Start waiting for communication parameters. |
| `kfcAlgExeStartTime` | Start executing the communication algorithm. |
| `sendTaskStartTime` | Start issuing the task. |
| `waitActiveStartTime` | Start waiting for activation. |
| `activeStartTime` | Start activation handling. |
| `waitExeEndStartTime` | Start waiting for the task to finish. |
| `rtsqExeEndTime` | Task execution finished. |

CCU channel records carry average / minimum / maximum transfer latency, which can be converted to bandwidth. msprof record names: AICPU `MsprofAicpuHcclTaskInfo`; CCU `CCUTaskInfo`, `CCUWaitSignalInfo`, `CCUGroupInfo`.

## `summary.db`

§11.9. Each metric CSV is also a table of the same name in `summary.db`. `PerformanceHints` is added on `Summary.jsonl`, not as one of those CSV mirrors.
