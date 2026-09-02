# HQ Open Questions

Please answer each **DATA** question with: **file name**, **field name**, and **formula** if the number is calculated.

Answers below are annotated with a status tag and, where known, `file → field` / formula.

When a question is answered: write it into the owning specs and **keep** the Q block here tagged **ANSWERED** (and **Implemented** when shipped). Process: [DEVELOPMENT.md § Resolving open questions](../process/DEVELOPMENT.md#resolving-open-questions).

**Sources (not all in git).** CI fixture is [`data/out.rep`](../../data/out.rep). Product dictionary is `npu-compute性能优化.docx` (外发版 0818, Ascend C Toolkit pack). `example.rep` is the same pack (`npu-tools-main-docs/docs/example.rep` when dropped locally; nested `npu-rep`; includes `HardwareInfo.jsonl`). Neither the docx nor `example.rep` is committed.

Design mockups: [`DESIGN_INDEX.md`](../ui/DESIGN_INDEX.md) · one annotated crop per question below · sources [`docs/ui/source/v930/`](../ui/source/v930/) · component crops under `src/ui/**/visual/` ([regenerate](visual/hq/README.md))

**Numbering.** This ledger is **HQ 1–36** (`q1.png`…`q36.png`). Answered items stay in place tagged **ANSWERED**; specs hold the normative decision. This ledger is **not** the Q1–Q23 space in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) — resolved OPEN Q22 (measure aside) is not HQ 22 (UB→L2/GM).

- **ANSWERED** — Product answered (source: [`355b2688f3684479b0b2b038a3b64513.docx`](../../355b2688f3684479b0b2b038a3b64513.docx), 2026-08-31). Write into owning specs; keep the Q block here tagged **ANSWERED** (add **Implemented** when code ships).
- **INTERIM** — we already ship a rule in [INTERIM_DECISIONS.md](INTERIM_DECISIONS.md); Product can still override.
- **PARTIAL** — field name known, but a value or a product decision is still missing.
- **OPEN** — not derivable from the current docs or sample.

Resolved right-panel mappings (进程 / 算子类型 / Blocks, Task Duration, measured I/O BW, ICache Miss, L2↔L1, NA handling) live in [VIEW_DATA_MAPPING.md](../ui/VIEW_DATA_MAPPING.md) and [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).

---

## DATA QUESTIONS

DATA = file/field/formula mapping from report data → visualized number/series/edge.

### 整体耗时 (Total duration)

**Design:** [`v930/report-stats-open`](../ui/source/v930/report-stats-open.jpeg) · [`summary-cards.png`](../../src/ui/StatsAside/StatsSummaryPanel/visual/summary-cards.png)

<img src="visual/hq/q1.png" alt="Q1 8 次迭代 / 核" width="600" height="370">

1. The line **N 次迭代 / 核** (N iterations / core) — which field? (Is it `Block Dim`?)
   - **ANSWERED** — Label = `OpBasicInfo.csv` → `Block Dim` / *core count*, where core count depends on `OpBasicInfo.csv` → `Op Type`:
     - **cube** → `HardwareInfo.jsonl` → `aic_cube_count` (also `ai_cube_count`)
     - **vector** → `HardwareInfo.jsonl` → `aic_vector_count` (also `ai_vector_count`)
     - **mix** → `HardwareInfo.jsonl` → `ai_core_count`
   - **Implemented** — `summary.coreCount` in adapter; secondary `{blockDim} / {coreCount}` in `StatsAside.vue` (HQ 1, slice 2).

### 算力情况 (Compute power)

**Design:** [`v930/report-stats-open`](../ui/source/v930/report-stats-open.jpeg) · [`summary-cards.png`](../../src/ui/StatsAside/StatsSummaryPanel/visual/summary-cards.png)

<img src="visual/hq/q2.png" alt="Q2 172 measured TFLOPS" width="600" height="370">

2. **172** (measured TFLOPS) — which file, which field(s), and the formula?
   - **ANSWERED (PARTIAL)** — Compute **cube** and **vector** separately (two columns per Q33). Product formulas (MFU / measured TFLOPS — accuracy TBD):
     - **Cube measured:** `MFU = (M×K×N) × 2 / aic_time(us)` (Product notes this may run high; needs confirmation). Ops basis: `Cycle × 16 × sizeof(dataType) × 16 × 2`.
     - **Cube peak (theoretical):** `16 × sizeof(dataType) × 16 × core_count × frequency × 2 / 1000` TFLOPS (example: 16×16×16×36×1.65 GHz×2/1000 ≈ 486 TFLOPS).
     - **Vector measured:** `MFU = M×N / aiv_time(us)` (may run high; needs confirmation). Ops basis: `Cycle × 16 × sizeof(dataType) × 16 × 2` (fp32/f16 computed separately).
     - **Vector peak (theoretical):** `128 × core_count × frequency × 2 / 1000` TFLOPS (example: 128×72×1.65 GHz×2/1000 ≈ 30 TFLOPS).
     - Inputs: `PipeUtilization.csv` `aic_time(us)` / `aiv_time(us)`; `HardwareInfo.jsonl` core counts and frequency; dtype from op context.
   - **Implemented (interim I-Q6h, slice 3)** — measured = mean `ArithmeticUtilization.csv` `*_fops` / mean `*_time(us)` → TFLOPS; peak per Q2/Q3 formulas with FP16 `sizeof` default.

---

<img src="visual/hq/q3.png" alt="Q3 320 peak TFLOPS" width="600" height="370">

3. **320** (peak TFLOPS) — which file and field? Or a fixed number per chip?
   - **ANSWERED (PARTIAL)** — Product will supply **fixed theoretical peak** values per chip (not in report CSV). Interim formula until constants arrive: cube and vector peaks per Q2 (`HardwareInfo.jsonl` core counts + frequency + dtype).
   - **Implemented (interim I-Q6h, slice 3)** — peak from Q2 formulas + `HardwareInfo.jsonl` / OpBasicInfo freq.

---

<img src="visual/hq/q4.png" alt="Q4 90% score" width="600" height="370">

4. **90** (score) — what is the formula? Is it `measured / peak × 100`?
   - **ANSWERED** — Yes: `score = measured / peak × 100%` per side (cube / vector). Peak from Q3.
   - **Implemented** — `computeCard` score + bar in `StatsAside.vue` (slice 3).

### 输入带宽 / 输出带宽 (Input / output bandwidth)

**Design:** [`v930/report-stats-open`](../ui/source/v930/report-stats-open.jpeg) · [`summary-cards.png`](../../src/ui/StatsAside/StatsSummaryPanel/visual/summary-cards.png)

On real data, `0.08 / 1.6` is about **5%**, not 81. So the score formula is unclear.

<img src="visual/hq/q5.png" alt="Q5 1.6 TB/s peak" width="900" height="225">

5. **1.6 TB/s** (peak) — which file and field?
   - **OPEN** — no peak-bandwidth field in any file; the doc's 内存负载 "理论值" column is empty for every row.

---

<img src="visual/hq/q6.png" alt="Q6 peak on aic, aiv, input, and output" width="900" height="225">

6. Is the peak the same for aic, aiv, input, and output? Yes or no. If no, give each peak.
   - **OPEN** — depends on Q5.

---

<img src="visual/hq/q7.png" alt="Q7 score 81" width="900" height="225">

7. **81** (score) — what is the formula? It is not `0.08 / 1.6`.
    - **OPEN** — no "score" concept; the doc maps raw bandwidth values only.

---

<img src="visual/hq/q8.png" alt="Q8 I/O bandwidth cards" width="900" height="225">

8. Do these cards come from `Report.csv` instead? If yes, list the column names.
    - **OPEN** — the doc names `Report.csv` once ("SOL / 平均带宽") but never lists columns, and it is absent from `example.rep`. Interim I-Q6g uses `Memory.csv`, not `Report.csv`.

### 平均核利用率 (Average core utilization)

**Design:** [`v930/report-stats-open`](../ui/source/v930/report-stats-open.jpeg) · [`summary-cards.png`](../../src/ui/StatsAside/StatsSummaryPanel/visual/summary-cards.png)

This card is hidden until we have answers.

<img src="visual/hq/q9.png" alt="Q9 82% utilization" width="590" height="370">

9. **82%** — which file, which field, and the formula?
    - **OPEN** — the doc's 平均核利用率 table is blank; no field or formula.

---

<img src="visual/hq/q10.png" alt="Q10 启用 24/24 核" width="590" height="370">

10. **24/24** in **启用 n/m 核** (enabled n/m cores) — which field is *n*? Which field is *m*?
    - **OPEN** — no "enabled cores" field. Sample `ai_core_count` = 36 (not 24); `Block Dim` = 8.

### Roofline 瓶颈分析 (Roofline bottleneck analysis)

**Design:** [`v930/report-stats-open`](../ui/source/v930/report-stats-open.jpeg) · [`roofline.png`](../../src/ui/StatsAside/RooflinePanel/visual/roofline.png)

<img src="visual/hq/q11.png" alt="Q11 Roofline chart — not pipe busy rates" width="900" height="655">

11. The old mapping uses `aic_cube_ratio`, `aic_mte2_ratio`, `aic_mte1_ratio`. Those are pipe busy rates, not chart axes. What should we use instead?
    - **OPEN** — the doc only repeats the old mapping; real Roofline axes are not documented.

---

<img src="visual/hq/q12.png" alt="Q12 X axis Ops/Byte" width="900" height="655">

12. **X axis** (Ops/Byte) — which file, fields, and formula? Is GM and L2 the same formula?
    - **OPEN** — no fields/formula.

---

<img src="visual/hq/q13.png" alt="Q13 Y axis TOps/s" width="900" height="655">

13. **Y axis** (TOps/s) — which file, fields, and formula?
    - **OPEN** — no formula (raw FLOPS counts `aic_cube_fops` / `aiv_vec_fops` exist but are not a TOps/s formula).

---

<img src="visual/hq/q14.png" alt="Q14 roof lines" width="900" height="655">

14. The **roof** lines (peak bandwidth and peak compute) — which file and fields?
    - **OPEN** — peak compute and peak bandwidth are documented nowhere.

---

<img src="visual/hq/q15.png" alt="Q15 L2 legend series" width="900" height="655">

15. The **L2** point on the chart needs bytes moved. Which field has L2 bytes? (`L2Cache.csv` only has hit counts.)
    - **OPEN (premise incomplete)** — correct that there is no *bytes* field in `L2Cache.csv`. But "only has hit counts" is incomplete: the sample also has hit **rates** — `aic_read_hit_rate(%)`, `aic_write_hit_rate(%)`, `aic_total_hit_rate(%)` (+ aiv). Note the doc's L2Cache dictionary (close/far hit/miss/victim) does **not** match the sample (r0/r1 read + write hit/miss + rates).

---

<img src="visual/hq/q16.png" alt="Q16 Vec_FP32 / Vec_MISC mix" width="900" height="655">

16. Labels like `Vec_FP32` / `Vec_MISC` — which file and fields? Which labels do we show if many are non-zero?
    - **PARTIAL** — fields exist in `ArithmeticUtilization.csv`: `aiv_vec_fp32_ratio`, `aiv_vec_fp16_ratio`, `aiv_vec_int32_ratio`, `aiv_vec_int16_ratio`, `aiv_vec_misc_ratio`. The doc's dictionary uses *different* names (`aiv_vec_vf_ratio`, `aiv_vec_sfu_ratio`, `aiv_vec_simt_vf_ratio`). The "which to show when many are non-zero" rule is undocumented.

---

<img src="visual/hq/q17.png" alt="Q17 Roofline tabs" width="900" height="655">

17. Tabs **内存单元** (memory unit), **内存通路** (memory path), **搬运单元** (transfer unit) — what should each tab show?
    - **PARTIAL** — the doc's Roofline table maps 内存单元→`aic_cube_ratio`, 内存通路→`aic_mte2_ratio`, 搬运单元→`aic_mte1_ratio` (all `PipeUtilization.csv`). This is exactly the "pipe busy rate" mapping Q11 flags as wrong.

### PIPE 占用率 / 计算负载分析 (Pipe occupancy / compute load)

**Design:** [`v930/compute-load`](../ui/source/v930/compute-load.jpeg) · [`pipe-bars.png`](../../src/ui/StatsAside/PipeOccupancyPanel/visual/pipe-bars.png) · [`v930/compute-load-detail`](../ui/source/v930/compute-load-detail.jpeg) · [`compute-detail-tabs.png`](../../src/ui/StatsAside/CsvFieldListPanel/visual/compute-detail-tabs.png)

These bars are already on screen. Please confirm.

<img src="visual/hq/q18.png" alt="Q18 number inside the bar" width="900" height="524">

18. The number **inside** the bar (for example `301001.38`) — is it time (`*_time(us)`) or cycles (`*_total_cycles`)?
    - **ANSWERED** — Show **cost time**: mean of non-`NA` `*_time(us)` for the same family/side as the ratio (`PipeUtilization.csv`). Not cycles.
    - **Implemented** (I-Q6f).

---

<img src="visual/hq/q19.png" alt="Q19 详情 overlay (selected block)" width="900" height="315">

19. On the summary bars, do we average all blocks? On **详情** (Details), do we show only the selected block?
    - **INTERIM** — [I-Q6b](INTERIM_DECISIONS.md): summary PIPE bars = mean of non-`NA` ratios across `block_id`. [I-Q6c](INTERIM_DECISIONS.md): **详情** / memory / metrics = selected block. Overlaps Q28–29. This crop is **详情**; summary mean is Q28.
    - **Product note (UI gap):** summary view is missing a **block selector** label; reference [`v930/compute-load-detail`](../ui/source/v930/compute-load-detail.jpeg).

### 内存负载分析 (Memory load analysis)

**Design:** [`v930/report-stats-scrolled`](../ui/source/v930/report-stats-scrolled.jpeg) · [`memory-topology.png`](../../src/ui/StatsAside/MemoryTopologyPanel/visual/memory-topology.png) · [`buffer-links.png`](../../src/ui/StatsAside/MemoryTopologyPanel/visual/buffer-links.png) · [`v930/memory-load-detail`](../ui/source/v930/memory-load-detail.jpeg)

Bandwidth labels on arrows are already mapped. These are still open.

<img src="visual/hq/q20.png" alt="Q20 Peak(%) on the L2 box" width="900" height="900">

20. **Peak (%)** color on each box — which file and field for each box?

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

    - **ANSWERED (PARTIAL)** — **L2 box only:** Peak(%) = **hit rate** (命中率) from `L2Cache.csv` (read/write/total × AIC/AIV still per Q21). Other boxes (GM, L1, L0*, Cube, FixP, UB, Vec, Scalar) — still no Product mapping.

---

<img src="visual/hq/q21.png" alt="Q21 L2Cache Hit Rate belongs on the GM↔L2 arrows" width="900" height="900">

21. **L2Cache Hit Rate** on the GM↔L2 arrow — which field: read, write, or total? Use AIC, AIV, or both?
    - **INTERIM** — adapter uses the first non-`NA` of `aic_total_hit_rate(%)`, `aiv_total_hit_rate(%)`, `aic_read_hit_rate(%)`, `aiv_read_hit_rate(%)`. Product has not picked read/write/total × AIC/AIV. This jpeg prints **GB/s** on those arrows, not a hit %.

---

<img src="visual/hq/q22.png" alt="Q22 UB to L2/GM arrow" width="900" height="900">

22. **UB → L2/GM** — which file and field? Two names exist:
    - `MemoryUB.csv`: `aiv_ub_read_bw_gm`
    - `Memory.csv`: `aiv_ub_to_gm_bw`
    - **INTERIM** — adapter tries `MemoryUB.csv` → `aiv_ub_read_bw_gm(GB/s)` first, then `Memory.csv` → `aiv_ub_to_gm_bw(GB/s)`. Sample MemoryUB has **no `*_gm` fields** (only `aiv_ub_read/write_bw_vector` and `_scalar`). Product has not unified the names.

---

<img src="visual/hq/q23.png" alt="Q23 L2/GM to UB arrow" width="900" height="900">

23. **L2/GM → UB** — which file and field?
    - `MemoryUB.csv`: `aiv_ub_write_bw_gm`
    - `Memory.csv`: `aiv_gm_to_ub_bw`
    - **INTERIM** — adapter tries `MemoryUB.csv` → `aiv_ub_write_bw_gm(GB/s)` first, then `Memory.csv` → `aiv_gm_to_ub_bw(GB/s)`. Same sample gap: no gm fields on MemoryUB.

---

<img src="visual/hq/q24.png" alt="Q24 L0C to L1" width="900" height="900">

24. **L0C → L1** — show it? If yes, which field? (`L0C_to_L1_datas(KB)`?)
    - **INTERIM** — we show `Memory.csv` → `L0C_to_L1_datas(KB)` when present (`L0C_to_L1_bw_usage_rate(%)` is unused). Product 理论值 is still 待确定. Sketch node is **LOC**.

---

<img src="visual/hq/q25.png" alt="Q25 L0C to L2/GM" width="900" height="900">

25. **L0C → L2/GM** — show it? If yes, which field? (`L0C_to_GM_datas(KB)`?)
    - **INTERIM** — we show `Memory.csv` → `L0C_to_GM_datas(KB)` when present. Product 理论值 is still 待确定. Same **LOC** node as Q24; this jpeg does not label the three L0C edges separately.

---

<img src="visual/hq/q26.png" alt="Q26 L0C to UB" width="900" height="900">

26. **L0C → UB** — show it? If yes, which field? (none in the sample)
    - **OPEN** — the doc leaves this blank (待确定); no field exists in sample or doc. Same **LOC** node as Q24–25; no L0C→UB edge is drawn.

---

<img src="visual/hq/q27.png" alt="Q27 leftover _XN_IMM — no Dual-Die arrows" width="900" height="944">

27. Dual-Die / Remote memory — show those arrows? Yes or no. If yes, which fields?
    - **OPEN (mismatch)** — the doc mentions remote memory / close-far access, but the sample `L2Cache.csv` uses `r0`/`r1` (not close/far). No concrete remote-arrow fields. Leftover `_XN_IMM` on the timeline strip is not a topology remote edge.

### Rules that apply everywhere

<img src="visual/hq/q28.png" alt="Q28 summary mean percent column" width="900" height="524">

28. A CSV often has many `block_id` rows (the sample has 8). For summary numbers, do we use **mean**, **max**, **first block**, or **the selected block**?
    - **INTERIM** — [I-Q6b](INTERIM_DECISIONS.md): mean of non-`NA` values across `block_id` for summary PIPE / I/O measured BW. Product has not confirmed mean vs max vs selected.
    - **Product note:** request a **general aggregation description document** (总的描述文件) covering block roll-up rules across widgets.

---

<img src="visual/hq/q29.png" alt="Q29 selected block switcher" width="900" height="318">

29. Same rule for every widget (cards, PIPE, Roofline, memory diagram)? Yes or no. If no, list the exceptions.
    - **INTERIM** — [I-Q6c](INTERIM_DECISIONS.md): summary PIPE (and I-Q6g measured BW) stay I-Q6b mean-across-blocks; **详情** / memory diagram / metrics lists are the selected block. Roofline interim aggregates like I-Q6b ([I-Q11a](INTERIM_DECISIONS.md)). This crop is the **详情** block switcher (the exception). Summary mean is Q28.

---

## UI/UX QUESTIONS

UI/UX = presentation, missing-input behavior, layout, units, gestures.

### Header

**Design:** [`v930/report-stats-open`](../ui/source/v930/report-stats-open.jpeg) · [`summary-cards.png`](../../src/ui/StatsAside/StatsSummaryPanel/visual/summary-cards.png) · [`v930/hardware-more-detail`](../ui/source/v930/hardware-more-detail.jpeg) · [`hardware-detail.png`](../../src/ui/StatsAside/HardwareDetailsPanel/visual/hardware-detail.png)

<img src="visual/hq/q30.png" alt="Q30 hardware-details overlay from HardwareInfo.jsonl" width="900" height="900">

30. Must every report include `HardwareInfo.jsonl`? Yes or no.
   - **ANSWERED** — **Yes** — every report is expected to include `HardwareInfo.jsonl`. If absent, **更多** still opens and shows **缺少 hardware info** (missing hardware info).
   - **Implemented** in `StatsAside.vue` (HQ 30–31, slice 1A).

---

<img src="visual/hq/q31.png" alt="Q31 更多" width="900" height="225">

31. If `HardwareInfo.jsonl` is missing, what happens to **更多** (More) / 硬件信息详情 (Hardware details)? Hide it, or show an empty page?
    - **ANSWERED** — Do **not** hide **更多**. Open overlay and show **缺少 hardware info**.
    - **Implemented** in `StatsAside.vue` (HQ 30–31, slice 1A).

### 整体耗时 (Total duration)

**Design:** [`v930/report-stats-open`](../ui/source/v930/report-stats-open.jpeg) · [`summary-cards.png`](../../src/ui/StatsAside/StatsSummaryPanel/visual/summary-cards.png)

<img src="visual/hq/q32.png" alt="Q32 duration bar" width="600" height="370">

32. The bar — is it only decoration, or a real percent? If a percent: percent of what? Give the field and formula.
    - **ANSWERED** — Real percent: `Block Dim / core_count × 100%` (core_count per Q1 from `HardwareInfo.jsonl`). Clamp display at **100%** when ratio exceeds 1.
    - **Implemented** — duration bar util % in `StatsAside.vue` (HQ 32, slice 2).

### 算力情况 (Compute power)

**Design:** [`v930/report-stats-open`](../ui/source/v930/report-stats-open.jpeg) · [`summary-cards.png`](../../src/ui/StatsAside/StatsSummaryPanel/visual/summary-cards.png)

<img src="visual/hq/q33.png" alt="Q33 one number, not aic|aiv columns" width="600" height="370">

33. One number for the whole op, or two columns (**aic** and **aiv**), like the bandwidth cards?
    - **ANSWERED** — **Separate columns** (cube \| vector / aic \| aiv), same layout as bandwidth cards.
    - **Implemented** — `computeCard` aic \| aiv columns in `StatsAside.vue` (slice 3).

### 输入带宽 / 输出带宽 (Input / output bandwidth)

**Design:** [`v930/report-stats-open`](../ui/source/v930/report-stats-open.jpeg) · [`summary-cards.png`](../../src/ui/StatsAside/StatsSummaryPanel/visual/summary-cards.png)

<img src="visual/hq/q34.png" alt="Q34 TB/s unit on the I/O footer" width="900" height="225">

34. If the measured value is small (for example `15.8 GB/s`), show **GB/s** or **TB/s**?
    - **ANSWERED** — Always **GB/s** (not TB/s).
    - **Implemented** — `formatGBs()` in `StatsAside.vue`; subtitle `measured / peak GB/s` (HQ 34, slice 1A).

### 内存负载分析 (Memory load analysis)

**Design:** [`v930/report-stats-scrolled`](../ui/source/v930/report-stats-scrolled.jpeg) · [`memory-topology.png`](../../src/ui/StatsAside/MemoryTopologyPanel/visual/memory-topology.png) · [`buffer-links.png`](../../src/ui/StatsAside/MemoryTopologyPanel/visual/buffer-links.png)

<img src="visual/hq/q35.png" alt="Q35 memory diagram — no right-click UI in the mockup" width="900" height="900">

35. Right-click on the memory diagram — extra details? Yes or no. If yes, which fields?
    - **ANSWERED** — **Yes.** Show full CSV tables: **Memory**, **L2Cache**, **MemoryUB**, **MemoryL0** (block-scoped per I-Q6c).

---

<img src="visual/hq/q36.png" alt="Q36 GB/s on GM↔L2 arrows" width="900" height="900">

36. Some labels are **KB**, some are **GB/s**. Keep both, or convert to one unit?
    - **OPEN** — unit/UX decision. This frame only has **GB/s**; KB would be L0C datas (`L0C_to_L1_datas(KB)`).

---

**Note (former HQ 37, removed on master):** Product answer doc (2026-08-31) requested **filter only** (no highlight). Master resolved this via [PR #52](https://github.com/IdeFrontend/profiling-report/pull/52) as **filter + highlight**; HQ 37 was dropped from this ledger. Reconcile with Product before changing shipped behavior.
