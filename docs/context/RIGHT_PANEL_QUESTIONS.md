# Right panel questions

Please answer each question with: **file name**, **field name**, and **formula** if the number is calculated.

---

## Header

Sketch shows: **核数** (core count) · **aic频率** (AIC frequency) · **NPU ARCH**

1. **核数** (core count) — which file and field?
2. **aic频率** (AIC frequency) — which file and field?
3. Do we also show **Rated Freq**? Yes or no. If yes, which field?
4. **NPU ARCH** (for example `212 teraOPs`) — which file and field?
5. Is that value a ready-made text, or a number we must format?
6. Must every report include `HardwareInfo.jsonl`? Yes or no.
7. If that file is missing, what happens to **更多** (More) / 硬件信息详情 (Hardware details)? Hide it, or show an empty page?

---

## 整体耗时 (Total duration)

Sketch shows: `4.06 ms`, a bar, and `8 次迭代 / 核` (8 iterations / core).

8. The big duration number — which file and field? (Today we use `OpBasicInfo.csv` → `Task Duration(us)`.)
9. The bar — is it only decoration, or a real percent? If a percent: percent of what? Give the field and formula.
10. The line **N 次迭代 / 核** (N iterations / core) — which field? (Is it `Block Dim`?)

---

## 算力情况 (Compute power)

This card is hidden until we have answers. Sketch shows: `90%` and `172 / 320 TFLOPS`.

11. **172** (measured TFLOPS) — which file, which field(s), and the formula?
12. **320** (peak TFLOPS) — which file and field? Or a fixed number per chip?
13. **90** (score) — what is the formula? Is it `measured / peak × 100`?
14. One number for the whole op, or two columns (**aic** and **aiv**), like the bandwidth cards?

---

## 输入带宽 / 输出带宽 (Input / output bandwidth)

Sketch shows a big number `81` and `0.08 / 1.6 TB/s` under it.

On real data, `0.08 / 1.6` is about **5%**, not 81. So the score formula is unclear.

15. **0.08** (measured input) — which file and field? (Today we use `Memory.csv` → `aic_main_mem_read_bw(GB/s)` and `aiv_main_mem_read_bw(GB/s)`.)
16. **0.08** (measured output) — which file and field? (Today we use the matching `*_write_bw(GB/s)` fields.)
17. **1.6 TB/s** (peak) — which file and field?
18. Is the peak the same for aic, aiv, input, and output? Yes or no. If no, give each peak.
19. **81** (score) — what is the formula? It is not `0.08 / 1.6`.
20. If the measured value is small (for example `15.8 GB/s`), show **GB/s** or **TB/s**?
21. Do these cards come from `Report.csv` instead? If yes, list the column names.

---

## 平均核利用率 (Average core utilization)

This card is hidden until we have answers. Sketch shows: `82%` and **启用 24/24 核** (enabled 24/24 cores).

22. **82%** — which file, which field, and the formula?
23. **24/24** in **启用 n/m 核** (enabled n/m cores) — which field is *n*? Which field is *m*?

---

## Roofline 瓶颈分析 (Roofline bottleneck analysis)

24. Tabs **内存单元** (memory unit), **内存通路** (memory path), **搬运单元** (transfer unit) — what should each tab show?
25. The old mapping uses `aic_cube_ratio`, `aic_mte2_ratio`, `aic_mte1_ratio`. Those are pipe busy rates, not chart axes. What should we use instead?
26. **X axis** (Ops/Byte) — which file, fields, and formula? Is GM and L2 the same formula?
27. **Y axis** (TOps/s) — which file, fields, and formula?
28. The **roof** lines (peak bandwidth and peak compute) — which file and fields?
29. The **L2** point on the chart needs bytes moved. Which field has L2 bytes? (`L2Cache.csv` only has hit counts.)
30. Labels like `Vec_FP32` / `Vec_MISC` — which file and fields? Which labels do we show if many are non-zero?

---

## PIPE 占用率 / 计算负载分析 (Pipe occupancy / compute load)

These bars are already on screen. Please confirm.

31. The number **inside** the bar (for example `301001.38`) — is it time (`*_time(us)`) or cycles (`*_total_cycles`)?
32. On the summary bars, do we average all blocks? On **详情** (Details), do we show only the selected block?
33. Show an **ICache Miss** row? Yes or no. If yes, which fields? (`aic_icache_miss_rate` / `aiv_icache_miss_rate`?)

---

## 内存负载分析 (Memory load analysis)

Bandwidth labels on arrows are already mapped. These are still open.

34. **Peak (%)** color on each box — which file and field for each box?

    | Box | File | Field |
    |-----|------|-------|
    | GM | | |
    | L2 | | |
    | L1 | | |
    | L0A / L0B / L0C | | |
    | Cube | | |
    | FixP | | |
    | UB | | |
    | Vec | | |
    | Scalar | | |

35. **L2Cache Hit Rate** on the GM↔L2 arrow — which field: read, write, or total? Use AIC, AIV, or both?
36. **UB → L2/GM** — which file and field? Two names exist:
    - `MemoryUB.csv`: `aiv_ub_read_bw_gm`
    - `Memory.csv`: `aiv_ub_to_gm_bw`
37. **L2/GM → UB** — which file and field?
    - `MemoryUB.csv`: `aiv_ub_write_bw_gm`
    - `Memory.csv`: `aiv_gm_to_ub_bw`
38. **L2 ↔ L1** — use `Memory.csv` (`aic_l1_*_bw`), or is a separate `MemoryL1.csv` required?
39. **L0C → L1** — show it? If yes, which field? (`L0C_to_L1_datas(KB)`?)
40. **L0C → L2/GM** — show it? If yes, which field? (`L0C_to_GM_datas(KB)`?)
41. **L0C → UB** — show it? If yes, which field? (none in the sample)
42. Dual-Die / Remote memory — show those arrows? Yes or no. If yes, which fields?
43. Right-click on the memory diagram — extra details? Yes or no. If yes, which fields?
44. Some labels are **KB**, some are **GB/s**. Keep both, or convert to one unit?

---

## Rules that apply everywhere

45. A CSV often has many `block_id` rows (the sample has 8). For summary numbers, do we use **mean**, **max**, **first block**, or **the selected block**?
46. Same rule for every widget (cards, PIPE, Roofline, memory diagram)? Yes or no. If no, list the exceptions.
47. A cell is `NA` — hide the row/card, show the text “NA”, or treat it as 0?
48. User selects a time range on the timeline (**度量模式** / measure mode). Do we recompute the right panel for that range? If yes, which parts: cards, PIPE, details, memory diagram, Roofline?
