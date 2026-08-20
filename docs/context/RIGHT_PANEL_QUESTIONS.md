# Right panel questions

Please answer each remaining question with: **file name**, **field name**, and **formula** if the number is calculated.

Chinese UI words have an English translation in parentheses.

---

## Header

Sketch shows: **核数** (core count) · **aic频率** (AIC frequency) · **NPU ARCH**

1. **核数** (core count) — which file and field? `HardwareInfo.jsonl` `ai_core_count` (chip = 36) or `OpBasicInfo.csv` `Block Dim` (this op = 8)?
2. **NPU ARCH** (sketch: `212 teraOPs`) — which file and field? Hardware has `chip_info` and `arch_info` (`3510`), not that string.
3. Is that value ready-made text, or a number we must format?

---

## 整体耗时 (Total duration)

Sketch shows: `4.06 ms`, a bar, and `8 次迭代 / 核` (8 iterations / core).

4. The bar — is it only decoration, or a real percent? If a percent: percent of what? Give the field and formula.
5. The line **N 次迭代 / 核** (N iterations / core) — which field? (Today we guess `Block Dim`.)

---

## 算力情况 (Compute power)

This card is hidden until we have answers. Sketch shows: `90%` and `172 / 320 TFLOPS`. Product table is still empty.

6. **172** (measured TFLOPS) — which file, which field(s), and the formula?
7. **320** (peak TFLOPS) — which file and field? Or a fixed number per chip?
8. **90** (score) — what is the formula? Is it `measured / peak × 100`?
9. One number for the whole op, or two columns (**aic** and **aiv**), like the bandwidth cards?

---

## 输入带宽 / 输出带宽 (Input / output bandwidth)

Measured columns are known. Sketch shows a big number `81` and `0.08 / 1.6 TB/s`. On real data, `0.08 / 1.6` is about **5%**, not 81.

10. **1.6 TB/s** (peak) — which file and field?
11. Is the peak the same for aic, aiv, input, and output? Yes or no. If no, give each peak.
12. **81** (score) — what is the formula? It is not `0.08 / 1.6`.
13. If the measured value is small (for example `15.8 GB/s`), show **GB/s** or **TB/s**?
14. Do these cards come from `Report.csv` instead? If yes, list the column names. (`Report.csv` is named “SOL / 平均带宽” but has no schema and is not in `example.rep`.)

---

## 平均核利用率 (Average core utilization)

This card is hidden until we have answers. Sketch shows: `82%` and **启用 24/24 核** (enabled 24/24 cores). Product table is still empty.

15. **82%** — which file, which field, and the formula?
16. **24/24** in **启用 n/m 核** (enabled n/m cores) — which field is *n*? Which field is *m*?

---

## Roofline 瓶颈分析 (Roofline bottleneck analysis)

17. Tabs **内存单元** (memory unit), **内存通路** (memory path), **搬运单元** (transfer unit) — what should each tab show?
18. The old mapping uses `aic_cube_ratio`, `aic_mte2_ratio`, `aic_mte1_ratio`. Those are pipe busy rates, not chart axes. What should we use instead?
19. **X axis** (Ops/Byte) — which file, fields, and formula? Is GM and L2 the same formula?
20. **Y axis** (TOps/s) — which file, fields, and formula?
21. The **roof** lines (peak bandwidth and peak compute) — which file and fields?
22. The **L2** point on the chart needs bytes moved. Which field has L2 bytes? (`L2Cache.csv` only has hit counts.)
23. Labels like `Vec_FP32` / `Vec_MISC` — which file and fields? Which labels do we show if many are non-zero?

---

## PIPE 占用率 / 计算负载分析 (Pipe occupancy / compute load)

24. The number **inside** the bar (for example `301001.38`) — is it time (`*_time(us)`) or cycles (`*_total_cycles`)?
25. On the summary bars, do we average all blocks? On **详情** (Details), do we show only the selected block?

---

## 内存负载分析 (Memory load analysis)

26. **Peak (%)** color on each box — which file and field for each box? (Product says we must know what 100% is. 理论值 / theoretical value column is empty.)

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

27. **L2Cache Hit Rate** on the GM↔L2 arrow — which field: read, write, or total? Use AIC, AIV, or both?
28. **L0C → L1** — show it? If yes, which field? (`L0C_to_L1_datas(KB)` is in the sample; product still 待确定 / to be determined.)
29. **L0C → L2/GM** — show it? If yes, which field? (`L0C_to_GM_datas(KB)`?)
30. **L0C → UB** — show it? If yes, which field? (none in the sample)
31. Dual-Die / Remote memory — show those arrows? Yes or no. If yes, which fields?
32. Right-click on the memory diagram — extra details? Yes or no. If yes, which fields?
33. Some labels are **KB**, some are **GB/s**. Keep both, or convert to one unit?

---

## Rules that apply everywhere

34. A CSV often has many `block_id` rows (the sample has 8). For summary numbers, do we use **mean**, **max**, **first block**, or **the selected block**?
35. Same rule for every widget (cards, PIPE, Roofline, memory diagram)? Yes or no. If no, list the exceptions.
36. User selects a time range on the timeline (**度量模式** / measure mode). Do we recompute the right panel for that range? If yes, which parts: cards, PIPE, details, memory diagram, Roofline?

---

## If you can only answer a few

Please answer: **6–9, 10, 12, 15–16, 19–21, 26, 34.**
