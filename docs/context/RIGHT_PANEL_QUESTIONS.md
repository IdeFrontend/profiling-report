# Right panel questions

Please answer each question with: **file name**, **field name**, and **formula** if the number is calculated.

Answers below are annotated with a status tag and, where known, `file → field` / formula. Sources: `example.rep` (the 11 embedded CSVs/JSONLs) and the `npu-compute性能优化.docx` field dictionary in `npu-tools/docs`.

- **RESOLVED** — Product-confirmed `file → field` (npu-compute 0818 / sample).
- **INTERIM** — we already ship a rule in [INTERIM_DECISIONS.md](INTERIM_DECISIONS.md); Product can still override.
- **PARTIAL** — field name known, but a value or a product decision is still missing.
- **OPEN** — not derivable from the current docs or sample.

---

## Header

Sketch shows: **核数** (core count) · **aic频率** (AIC frequency) · **NPU ARCH**

1. **核数** (core count) — which file and field?
   - **PARTIAL** — two candidates; Product has not picked the header slot. `HardwareInfo.jsonl` → `AI Core Information.ai_core_count` is the hardware-details field (sample = 36; also `ai_cube_count`=36, `ai_vector_count`=72). `OpBasicInfo.csv` → `Block Dim` is the per-op split (sample = 8, matches sketch **8 次迭代 / 核**). Meta row still unset ([OPEN_QUESTIONS](OPEN_QUESTIONS.md) Q7).

2. **aic频率** (AIC frequency) — which file and field?
   - **RESOLVED** (shell) — `OpBasicInfo.csv` → `Current Freq`. `HardwareInfo.jsonl` → `ai_core_frequency_MHZ` is a second source for the **更多** overlay (sample is an *array* `[100,100]`), not a tie for the meta row.

3. Do we also show **Rated Freq**? Yes or no. If yes, which field?
   - **INTERIM** — field is `OpBasicInfo.csv` → `Rated Freq` ("AI处理器的理论频率"). Shell does **not** show it (VIEW_DATA_MAPPING). Parsed onto `summary.ratedFreq` for details fallback only.

4. **NPU ARCH** (for example `212 teraOPs`) — which file and field?
   - **PARTIAL** — the *name* is `HardwareInfo.jsonl` → `chip_info` ("Ascend 950PR_9599 V100") and `arch_info` ("3510"). But "212 teraOPs" is a peak-compute number that appears in **no file** and is documented nowhere.

5. Is that value a ready-made text, or a number we must format?
   - **OPEN** — depends on the unresolved teraOPs value. `chip_info`/`arch_info` are strings; teraOPs is absent.

6. Must every report include `HardwareInfo.jsonl`? Yes or no.
   - **OPEN** — the doc shows it is collected during 基础信息采集, but gives no availability guarantee.

7. If that file is missing, what happens to **更多** (More) / 硬件信息详情 (Hardware details)? Hide it, or show an empty page?
   - **INTERIM** — [I-Q7a](INTERIM_DECISIONS.md): prefer `HardwareInfo.jsonl`; fall back to non-empty `OpBasicInfo.csv` columns; hide the overlay when both are empty. Product can still override.

---

## 整体耗时 (Total duration)

Sketch shows: `4.06 ms`, a bar, and `8 次迭代 / 核` (8 iterations / core).

8. The big duration number — which file and field? (Today we use `OpBasicInfo.csv` → `Task Duration(us)`.)
   - **RESOLVED** — `OpBasicInfo.csv` → `Task Duration(us)`. The doc's 报告统计 table item 4 maps 整体耗时 to this field explicitly.

9. The bar — is it only decoration, or a real percent? If a percent: percent of what? Give the field and formula.
   - **INTERIM** — [I-Q6e](INTERIM_DECISIONS.md): decorative (fixed short cyan fill), not a % of peak. Product has not defined a scale.

10. The line **N 次迭代 / 核** (N iterations / core) — which field? (Is it `Block Dim`?)
    - **INTERIM** — [I-Q6e](INTERIM_DECISIONS.md) uses `OpBasicInfo.csv` → `Block Dim` ("Task运行切分数量，对应Task运行时核数"). Sample = 8, matching the sketch. "Iterations-per-core" vs "block count" is not explicitly equated by Product.

---

## 算力情况 (Compute power)

This card is hidden until we have answers. Sketch shows: `90%` and `172 / 320 TFLOPS`.

11. **172** (measured TFLOPS) — which file, which field(s), and the formula?
    - **OPEN** — the doc's 算力情况 table is blank. Only raw FLOPS *counts* exist (`ArithmeticUtilization.csv` → `aic_cube_fops`, `aiv_vec_fops`); no TFLOPS formula.

12. **320** (peak TFLOPS) — which file and field? Or a fixed number per chip?
    - **OPEN** — no peak-compute field in any file; not documented.

13. **90** (score) — what is the formula? Is it `measured / peak × 100`?
    - **OPEN** — no "score" concept documented.

14. One number for the whole op, or two columns (**aic** and **aiv**), like the bandwidth cards?
    - **OPEN** — no display rule documented.

---

## 输入带宽 / 输出带宽 (Input / output bandwidth)

Sketch shows a big number `81` and `0.08 / 1.6 TB/s` under it.

On real data, `0.08 / 1.6` is about **5%**, not 81. So the score formula is unclear.

15. **0.08** (measured input) — which file and field? (Today we use `Memory.csv` → `aic_main_mem_read_bw(GB/s)` and `aiv_main_mem_read_bw(GB/s)`.)
    - **RESOLVED** — `Memory.csv` → `aic_main_mem_read_bw(GB/s)` + `aiv_main_mem_read_bw(GB/s)`. Doc 报告统计 item 6 confirms.

16. **0.08** (measured output) — which file and field? (Today we use the matching `*_write_bw(GB/s)` fields.)
    - **RESOLVED** — `Memory.csv` → `aic_main_mem_write_bw(GB/s)` + `aiv_main_mem_write_bw(GB/s)`. Doc 报告统计 item 7 confirms.

17. **1.6 TB/s** (peak) — which file and field?
    - **OPEN** — no peak-bandwidth field in any file; the doc's 内存负载 "理论值" column is empty for every row.

18. Is the peak the same for aic, aiv, input, and output? Yes or no. If no, give each peak.
    - **OPEN** — depends on Q17.

19. **81** (score) — what is the formula? It is not `0.08 / 1.6`.
    - **OPEN** — no "score" concept; the doc maps raw bandwidth values only.

20. If the measured value is small (for example `15.8 GB/s`), show **GB/s** or **TB/s**?
    - **OPEN** — UX decision.

21. Do these cards come from `Report.csv` instead? If yes, list the column names.
    - **OPEN** — the doc names `Report.csv` once ("SOL / 平均带宽") but never lists columns, and it is absent from `example.rep`.

---

## 平均核利用率 (Average core utilization)

This card is hidden until we have answers. Sketch shows: `82%` and **启用 24/24 核** (enabled 24/24 cores).

22. **82%** — which file, which field, and the formula?
    - **OPEN** — the doc's 平均核利用率 table is blank; no field or formula.

23. **24/24** in **启用 n/m 核** (enabled n/m cores) — which field is *n*? Which field is *m*?
    - **OPEN** — no "enabled cores" field. Sample `ai_core_count` = 36 (not 24); `Block Dim` = 8.

---

## Roofline 瓶颈分析 (Roofline bottleneck analysis)

24. Tabs **内存单元** (memory unit), **内存通路** (memory path), **搬运单元** (transfer unit) — what should each tab show?
    - **PARTIAL** — the doc's Roofline table maps 内存单元→`aic_cube_ratio`, 内存通路→`aic_mte2_ratio`, 搬运单元→`aic_mte1_ratio` (all `PipeUtilization.csv`). This is exactly the "pipe busy rate" mapping Q25 flags as wrong.

25. The old mapping uses `aic_cube_ratio`, `aic_mte2_ratio`, `aic_mte1_ratio`. Those are pipe busy rates, not chart axes. What should we use instead?
    - **OPEN** — the doc only repeats the old mapping; real Roofline axes are not documented.

26. **X axis** (Ops/Byte) — which file, fields, and formula? Is GM and L2 the same formula?
    - **OPEN** — no fields/formula.

27. **Y axis** (TOps/s) — which file, fields, and formula?
    - **OPEN** — no formula (raw FLOPS counts `aic_cube_fops` / `aiv_vec_fops` exist but are not a TOps/s formula).

28. The **roof** lines (peak bandwidth and peak compute) — which file and fields?
    - **OPEN** — peak compute and peak bandwidth are documented nowhere.

29. The **L2** point on the chart needs bytes moved. Which field has L2 bytes? (`L2Cache.csv` only has hit counts.)
    - **OPEN (premise incomplete)** — correct that there is no *bytes* field in `L2Cache.csv`. But "only has hit counts" is incomplete: the sample also has hit **rates** — `aic_read_hit_rate(%)`, `aic_write_hit_rate(%)`, `aic_total_hit_rate(%)` (+ aiv). Note the doc's L2Cache dictionary (close/far hit/miss/victim) does **not** match the sample (r0/r1 read + write hit/miss + rates).

30. Labels like `Vec_FP32` / `Vec_MISC` — which file and fields? Which labels do we show if many are non-zero?
    - **PARTIAL** — fields exist in `ArithmeticUtilization.csv`: `aiv_vec_fp32_ratio`, `aiv_vec_fp16_ratio`, `aiv_vec_int32_ratio`, `aiv_vec_int16_ratio`, `aiv_vec_misc_ratio`. The doc's dictionary uses *different* names (`aiv_vec_vf_ratio`, `aiv_vec_sfu_ratio`, `aiv_vec_simt_vf_ratio`). The "which to show when many are non-zero" rule is undocumented.

---

## PIPE 占用率 / 计算负载分析 (Pipe occupancy / compute load)

These bars are already on screen. Please confirm.

31. The number **inside** the bar (for example `301001.38`) — is it time (`*_time(us)`) or cycles (`*_total_cycles`)?
    - **INTERIM** — [I-Q6f](INTERIM_DECISIONS.md): mean of non-`NA` `*_time(us)` for the same family/side as the ratio; omit when all NA. Not cycles. Sketch `301001.38` does not match `example.rep` magnitudes (fixture mismatch, not a missing mapping). Product can still pick cycles.

32. On the summary bars, do we average all blocks? On **详情** (Details), do we show only the selected block?
    - **INTERIM** — [I-Q6b](INTERIM_DECISIONS.md): summary PIPE bars = mean of non-`NA` ratios across `block_id`. [I-Q6c](INTERIM_DECISIONS.md): **详情** / memory / metrics = selected block. Overlaps Q45–46.

33. Show an **ICache Miss** row? Yes or no. If yes, which fields? (`aic_icache_miss_rate` / `aiv_icache_miss_rate`?)
    - **RESOLVED** — `PipeUtilization.csv` → `aic_icache_miss_rate` (Cube) and `aiv_icache_miss_rate` (Vector). The doc's 计算负载 tables map both.

---

## 内存负载分析 (Memory load analysis)

Bandwidth labels on arrows are already mapped. These are still open.

34. **Peak (%)** color on each box — which file and field for each box?

    | Box | File | Field |
    |-----|------|-------|
    | GM | — | no Peak(%) / 理论值. `aic/aiv_main_mem_*_bw` is GM↔L2 *arrow* BW, not a box peak |
    | L2 | — | no Peak(%) field. Do **not** use `aic_l1_*_bw` (that is L1 arrow BW) |
    | L1 | — | no 理论值. `Memory.csv` `aic_l1_read/write_bw` is L2↔L1 *arrow* BW, not a box peak |
    | L0A / L0B / L0C | — | no 理论值. `MemoryL0.csv` `aic_l0a/l0b/l0c_*_bw` is measured arrow BW |
    | Cube | — | `aic_cube_ratio` is pipe occupancy, not Peak(%) unless Product says so |
    | FixP | — | `aic_fixpipe_ratio` is pipe occupancy, not Peak(%) |
    | UB | — | no 理论值. `MemoryUB.csv` `aiv_ub_read/write_bw_*` is measured arrow BW |
    | Vec | — | `aiv_vec_ratio` is pipe occupancy, not Peak(%) |
    | Scalar | — | `aic/aiv_scalar_ratio` is pipe occupancy, not Peak(%) |

    - **PARTIAL** — VIEW_DATA_MAPPING: Peak(%) has no field mapping. The doc's 理论值 column is empty for every row, so the percentage cannot be computed. Measured arrow BW and pipe ratios are not a substitute.

35. **L2Cache Hit Rate** on the GM↔L2 arrow — which field: read, write, or total? Use AIC, AIV, or both?
    - **PARTIAL** — the doc maps "L2Cache Hit Rate → L2Cache.csv" with no detail. Fields exist for read/write/total × aic/aiv, but which combination is unspecified.

36. **UB → L2/GM** — which file and field? Two names exist:
    - `MemoryUB.csv`: `aiv_ub_read_bw_gm`
    - `Memory.csv`: `aiv_ub_to_gm_bw`
    - **OPEN (doc/sample contradiction)** — the doc says `MemoryUB.csv → aiv_ub_read_bw_gm`, but the sample `MemoryUB.csv` has **no `*_gm` fields** (only `aiv_ub_read/write_bw_vector` and `_scalar`). The sample's `Memory.csv` has `aiv_ub_to_gm_bw(GB/s)`.

37. **L2/GM → UB** — which file and field?
    - `MemoryUB.csv`: `aiv_ub_write_bw_gm`
    - `Memory.csv`: `aiv_gm_to_ub_bw`
    - **OPEN (doc/sample contradiction)** — same issue: doc says `MemoryUB.csv → aiv_ub_write_bw_gm`; the sample has `Memory.csv → aiv_gm_to_ub_bw(GB/s)` and no gm fields in MemoryUB.csv.

38. **L2 ↔ L1** — use `Memory.csv` (`aic_l1_*_bw`), or is a separate `MemoryL1.csv` required?
    - **RESOLVED** — `Memory.csv` → `aic_l1_read_bw(GB/s)` (L2→L1) and `aic_l1_write_bw(GB/s)` (L1→L2). No `MemoryL1.csv` exists.

39. **L0C → L1** — show it? If yes, which field? (`L0C_to_L1_datas(KB)`?)
    - **PARTIAL** — field exists in `Memory.csv` → `L0C_to_L1_datas(KB)` + `L0C_to_L1_bw_usage_rate(%)`. The doc marks its 理论值 待确定; "show or not" is a decision.

40. **L0C → L2/GM** — show it? If yes, which field? (`L0C_to_GM_datas(KB)`?)
    - **PARTIAL** — field exists in `Memory.csv` → `L0C_to_GM_datas(KB)` + `L0C_to_GM_bw_usage_rate(%)`. Doc 理论值 待确定.

41. **L0C → UB** — show it? If yes, which field? (none in the sample)
    - **OPEN** — the doc leaves this blank (待确定); no field exists in sample or doc.

42. Dual-Die / Remote memory — show those arrows? Yes or no. If yes, which fields?
    - **OPEN (mismatch)** — the doc mentions remote memory / close-far access, but the sample `L2Cache.csv` uses `r0`/`r1` (not close/far). No concrete remote-arrow fields.

43. Right-click on the memory diagram — extra details? Yes or no. If yes, which fields?
    - **OPEN** — the doc only asks "是否有右击的详情" without specifying fields.

44. Some labels are **KB**, some are **GB/s**. Keep both, or convert to one unit?
    - **OPEN** — unit/UX decision.

---

## Rules that apply everywhere

45. A CSV often has many `block_id` rows (the sample has 8). For summary numbers, do we use **mean**, **max**, **first block**, or **the selected block**?
    - **INTERIM** — [I-Q6b](INTERIM_DECISIONS.md): mean of non-`NA` values across `block_id` for summary PIPE / I/O measured BW. Product has not confirmed mean vs max vs selected.

46. Same rule for every widget (cards, PIPE, Roofline, memory diagram)? Yes or no. If no, list the exceptions.
    - **INTERIM** — [I-Q6c](INTERIM_DECISIONS.md): summary PIPE (and I-Q6g measured BW) stay I-Q6b mean-across-blocks; **详情** / memory diagram / metrics lists are the selected block. Roofline interim aggregates like I-Q6b ([I-Q11a](INTERIM_DECISIONS.md)).

47. A cell is `NA` — hide the row/card, show the text "NA", or treat it as 0?
    - **RESOLVED** — doc line "NA的参数值不做显示, 0值照常显示": hide `NA`, show `0` as-is.

48. User selects a time range on the timeline (**度量模式** / measure mode). Do we recompute the right panel for that range? If yes, which parts: cards, PIPE, details, memory diagram, Roofline?
    - **OPEN** — not documented.
