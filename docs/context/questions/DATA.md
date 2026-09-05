# DATA questions

Open **DATA** questions (file/field/formula data mapping). Status enum, prefix taxonomy, and migration map: [README.md](README.md).

### DATA-2 — 172 measured TFLOPS

<img src="../visual/questions/data-2.png" alt="DATA-2 172 measured TFLOPS" width="880" height="400">

**Status:** `partial`

**Question:** **172** (measured TFLOPS) — which file, which field(s), and the formula?

**Answer so far:** Compute **cube** and **vector** separately (two columns per UI-33). Product formulas (MFU / measured TFLOPS — accuracy TBD):

- **Cube measured:** `MFU = (M×K×N) × 2 / aic_time(us)` (may run high; needs confirmation). Ops basis: `Cycle × 16 × sizeof(dataType) × 16 × 2`.
- **Cube peak (theoretical):** `16 × sizeof(dataType) × 16 × core_count × frequency × 2 / 1000` TFLOPS.
- **Vector measured:** `MFU = M×N / aiv_time(us)` (may run high). Ops basis: `Cycle × 16 × sizeof(dataType) × 16 × 2` (fp32/f16 separately).
- **Vector peak (theoretical):** `128 × core_count × frequency × 2 / 1000` TFLOPS.
- Inputs: `PipeUtilization.csv` `aic_time(us)` / `aiv_time(us)`; `HardwareInfo.jsonl` core counts + frequency; dtype from op context.

**Implemented (interim [`DATA-33h`](../decisions/interim/DATA.md)):** measured = mean `ArithmeticUtilization.csv` `*_fops` / mean `*_time(us)` → TFLOPS; peak per DATA-2/DATA-3 formulas with FP16 `sizeof` default.

### DATA-3 — 320 peak TFLOPS

<img src="../visual/questions/data-3.png" alt="DATA-3 320 peak TFLOPS" width="880" height="400">

**Status:** `partial`

**Question:** **320** (peak TFLOPS) — which file and field? Or a fixed number per chip?

**Answer so far:** Product will supply **fixed theoretical peak** values per chip (not in report CSV). Interim formula until constants arrive: cube and vector peaks per DATA-2 (`HardwareInfo.jsonl` core counts + frequency + dtype).

**Implemented (interim [`DATA-33h`](../decisions/interim/DATA.md)):** peak from DATA-2 formulas + `HardwareInfo.jsonl` / OpBasicInfo freq.

### DATA-5 — 1.6 TB/s peak bandwidth

<img src="../visual/questions/data-5.png" alt="DATA-5 1.6 TB/s peak" width="880" height="400">

**Status:** `open`

**Question:** **1.6 TB/s** (peak) on the **带宽利用率** 读\|写 card — which file and field?

**Note:** Sketch (v930 refresh) is one **带宽利用率** card with **读 \| 写**. Former separate 输入/输出 × aic\|aiv card layout is retired (do not re-ask that chrome). Peak/score still apply to the 读\|写 card. Interim [`DATA-33g`](../decisions/interim/DATA.md).

### DATA-6 — peak same for 读 / 写?

<img src="../visual/questions/data-6.png" alt="DATA-6 peak on 读 and 写" width="880" height="400">

**Status:** `open`

**Question:** Is the peak the same for **读** and **写**? If no, give each peak. (Depends on DATA-5.)

**Note:** Former four-way aic/aiv × input/output peaks question is retired with the 读\|写 layout.

### DATA-7 — 81 score

<img src="../visual/questions/data-7.png" alt="DATA-7 score 81" width="880" height="400">

**Status:** `open`

**Question:** **81** (score) on the bandwidth card — what is the formula? It is not `0.08 / 1.6`.

### DATA-8 — 带宽利用率 from `Report.csv`?

<img src="../visual/questions/data-8.png" alt="DATA-8 带宽利用率 card" width="880" height="400">

**Status:** `open`

**Question:** Does this **带宽利用率** card come from `Report.csv` instead? If yes, list the column names. (Interim [`DATA-33g`](../decisions/interim/DATA.md) uses `Memory.csv`, not `Report.csv`.)

### DATA-9 — AICore 并行使用率

<img src="../visual/questions/data-9.png" alt="DATA-9 并行使用率" width="880" height="380">

**Status:** `open`

**Question:** **并行使用率** (e.g. sketch **81%**) — which file, which field, and the formula?

**Note:** Sketch (v930 refresh) dual columns **并行使用率** \| **负载均衡度** replace the former **平均核利用率** card. Ask formulas for the new labels only. UI ships title + `N/A` via [`DATA-33a`](../decisions/interim/DATA.md).

### DATA-10 — 负载均衡度

<img src="../visual/questions/data-10.png" alt="DATA-10 负载均衡度" width="880" height="380">

**Status:** `open`

**Question:** **负载均衡度** (e.g. sketch **90%**) — which file, which field, and the formula?

**Note:** Former **启用 n/m 核** secondary line is gone from the v930 refresh sketch — do not map n/m core fields for this card.
### DATA-11 — Roofline axes vs pipe busy rates

<img src="../visual/questions/data-11.png" alt="DATA-11 Roofline chart — not pipe busy rates" width="900" height="655">

**Status:** `open`

**Question:** The old mapping uses `aic_cube_ratio`, `aic_mte2_ratio`, `aic_mte1_ratio` (pipe busy rates). What should we use instead? Real Roofline axes are undocumented.

### DATA-12 — X axis Ops/Byte

<img src="../visual/questions/data-12.png" alt="DATA-12 X axis Ops/Byte" width="900" height="655">

**Status:** `open`

**Question:** **X axis** (Ops/Byte) — file, fields, formula? Is GM and L2 the same formula?

### DATA-13 — Y axis TOps/s

<img src="../visual/questions/data-13.png" alt="DATA-13 Y axis TOps/s" width="900" height="655">

**Status:** `open`

**Question:** **Y axis** (TOps/s) — file, fields, formula? (Raw `aic_cube_fops` / `aiv_vec_fops` exist but are not a TOps/s formula.)

### DATA-14 — roof lines

<img src="../visual/questions/data-14.png" alt="DATA-14 roof lines" width="900" height="655">

**Status:** `open`

**Question:** The **roof** lines (peak bandwidth and peak compute) — which file and fields?

### DATA-15 — L2 bytes

<img src="../visual/questions/data-15.png" alt="DATA-15 L2 legend series" width="900" height="655">

**Status:** `open`

**Question:** The **L2** point needs bytes moved. Which field has L2 bytes? (`L2Cache.csv` has hit counts and hit *rates*, no byte traffic.)

### DATA-16 — Vec_FP32 / Vec_MISC mix labels

<img src="../visual/questions/data-16.png" alt="DATA-16 Vec_FP32 / Vec_MISC mix" width="900" height="655">

**Status:** `partial`

**Question:** Labels like `Vec_FP32` / `Vec_MISC` — which file and fields? Which labels when many are non-zero?

**Answer so far:** Fields exist in `ArithmeticUtilization.csv`: `aiv_vec_fp32_ratio`, `aiv_vec_fp16_ratio`, `aiv_vec_int32_ratio`, `aiv_vec_int16_ratio`, `aiv_vec_misc_ratio`. The docx dictionary uses *different* names (`aiv_vec_vf_ratio`, `aiv_vec_sfu_ratio`, `aiv_vec_simt_vf_ratio`). The "which to show when many are non-zero" rule is undocumented.

### DATA-17 — Roofline tabs

<img src="../visual/questions/data-17.png" alt="DATA-17 Roofline tabs" width="900" height="655">

**Status:** `partial`

**Question:** Tabs **内存单元** / **内存通路** / **搬运单元** — what should each tab show?

**Answer so far:** The docx Roofline table maps 内存单元→`aic_cube_ratio`, 内存通路→`aic_mte2_ratio`, 搬运单元→`aic_mte1_ratio` (all `PipeUtilization.csv`) — the pipe-busy-rate mapping DATA-11 flags as wrong.

### DATA-19 — summary vs 详情 block scope

<img src="../visual/questions/data-19.png" alt="DATA-19 详情 overlay (selected block)" width="900" height="315">

**Status:** `interim`

**Question:** On the summary bars, do we average all blocks? On **详情**, do we show only the selected block?

**Interim:** summary PIPE bars = mean of non-`NA` ratios across `block_id` ([`DATA-33b`](../decisions/interim/DATA.md)); **详情** / memory / metrics = selected block ([`DATA-33c`](../decisions/interim/DATA.md)). Product note: summary view is missing a **block selector** label.

### DATA-20 — Peak(%) box colors

<img src="../visual/questions/data-20.png" alt="DATA-20 Peak(%) on the L2 box" width="900" height="900">

**Status:** `partial`

**Question:** **Peak (%)** color on each memory-diagram box — which file and field for each box?

**Answer so far:** **L2 box only:** Peak(%) = **hit rate** (命中率) from `L2Cache.csv` (read/write/total × AIC/AIV still per DATA-21). Other boxes (GM, L1, L0*, Cube, FixP, UB, Vec, Scalar) — still no Product mapping.

### DATA-21 — L2Cache Hit Rate on GM↔L2 arrow

<img src="../visual/questions/data-21.png" alt="DATA-21 L2Cache Hit Rate on the GM↔L2 arrows" width="900" height="900">

**Status:** `interim`

**Question:** **L2Cache Hit Rate** on the GM↔L2 arrow — read, write, or total? AIC, AIV, or both?

**Interim:** adapter uses the first non-`NA` of `aic_total_hit_rate(%)`, `aiv_total_hit_rate(%)`, `aic_read_hit_rate(%)`, `aiv_read_hit_rate(%)`. Product has not picked read/write/total × AIC/AIV.

### DATA-22 — UB → L2/GM arrow

<img src="../visual/questions/data-22.png" alt="DATA-22 UB to L2/GM arrow" width="900" height="900">

**Status:** `interim`

**Question:** **UB → L2/GM** — which file and field? Two names exist: `MemoryUB.csv` `aiv_ub_read_bw_gm` vs `Memory.csv` `aiv_ub_to_gm_bw`.

**Interim:** adapter tries `MemoryUB.csv` → `aiv_ub_read_bw_gm(GB/s)` first, then `Memory.csv` → `aiv_ub_to_gm_bw(GB/s)`. Sample MemoryUB has **no `*_gm` fields**.

### DATA-23 — L2/GM → UB arrow

<img src="../visual/questions/data-23.png" alt="DATA-23 L2/GM to UB arrow" width="900" height="900">

**Status:** `interim`

**Question:** **L2/GM → UB** — which file and field? (`MemoryUB.csv` `aiv_ub_write_bw_gm` vs `Memory.csv` `aiv_gm_to_ub_bw`.)

**Interim:** adapter tries `MemoryUB.csv` → `aiv_ub_write_bw_gm(GB/s)` first, then `Memory.csv` → `aiv_gm_to_ub_bw(GB/s)`. Same sample gap: no gm fields on MemoryUB.

### DATA-24 — L0C → L1

<img src="../visual/questions/data-24.png" alt="DATA-24 L0C to L1" width="900" height="900">

**Status:** `interim`

**Question:** **L0C → L1** — show it? Which field? (`L0C_to_L1_datas(KB)`?)

**Interim:** show `Memory.csv` → `L0C_to_L1_datas(KB)` when present. Product 理论值 is still 待确定. Sketch node is **LOC**.

### DATA-25 — L0C → L2/GM

<img src="../visual/questions/data-25.png" alt="DATA-25 L0C to L2/GM" width="900" height="900">

**Status:** `interim`

**Question:** **L0C → L2/GM** — show it? Which field? (`L0C_to_GM_datas(KB)`?)

**Interim:** show `Memory.csv` → `L0C_to_GM_datas(KB)` when present. Same **LOC** node as DATA-24.

### DATA-26 — L0C → UB

<img src="../visual/questions/data-26.png" alt="DATA-26 L0C to UB" width="900" height="900">

**Status:** `open`

**Question:** **L0C → UB** — show it? Which field? (None in the sample.)

### DATA-27 — Dual-Die / Remote memory

<img src="../visual/questions/data-27.png" alt="DATA-27 leftover _XN_IMM — no Dual-Die arrows" width="900" height="944">

**Status:** `open`

**Question:** Dual-Die / Remote memory — show those arrows? Which fields? (Docx mentions remote/close-far access, but sample `L2Cache.csv` uses `r0`/`r1`.)

### DATA-28 — summary aggregation (mean / max / first / selected)

<img src="../visual/questions/data-28.png" alt="DATA-28 summary mean percent column" width="900" height="524">

**Status:** `interim`

**Question:** A CSV often has many `block_id` rows. For summary numbers, **mean**, **max**, **first block**, or **selected block**?

**Interim:** [`DATA-33b`](../decisions/interim/DATA.md): mean of non-`NA` values across `block_id` for summary PIPE / I/O measured BW. Product note: request a **general aggregation description document**.

### DATA-29 — same rule for every widget?

<img src="../visual/questions/data-29.png" alt="DATA-29 selected block switcher" width="900" height="318">

**Status:** `interim`

**Question:** Same aggregation rule for every widget (cards, PIPE, Roofline, memory diagram)?

**Interim:** [`DATA-33c`](../decisions/interim/DATA.md): summary PIPE (and measured BW) stay mean-across-blocks; **详情** / memory diagram / metrics lists are the selected block. Roofline aggregates like [`DATA-33b`](../decisions/interim/DATA.md).

### DATA-31 — authoritative MVP fixture shape (was: Q4)

**Status:** `partial`

**Question:** Authoritative MVP fixture shape?

**Answer so far:** Product target = sketch-like Gantt (A). **CI fixture** = `out.rep` until golden — [`DATA-31a`](../decisions/interim/DATA.md).

### DATA-33 — report summary formulas (was: Q6)

**Status:** `interim`

**Question:** Report summary formulas?

**Answer so far (interim):** duration = `OpBasicInfo.csv` `Task Duration(us)` ([`DATA-33e`](../decisions/interim/DATA.md)); compute Cube\|Vector when `computeCard` exists ([`DATA-33h`](../decisions/interim/DATA.md)); bandwidth **measured** + 读\|写 card ([`DATA-33g`](../decisions/interim/DATA.md)); I/O display **GB/s** (UI-34). AICore **并行使用率** / **负载均衡度** stay **N/A** until DATA-9/DATA-10. PIPE = mean non-`NA` ([`DATA-33b`](../decisions/interim/DATA.md)). MIX Cube\|Vector + ICache Miss confirmed. **Open:** bandwidth peak/score/aggregation (DATA-5–8); compute MFU/chip peaks/dtype (DATA-2/3); `block_id` roll-up (DATA-28/29). Interims: [`DATA-33a…DATA-33h`](../decisions/interim/DATA.md).

### DATA-36 — dependencies encoding (was: Q9)

**Status:** `open` + `interim`

**Question:** Dependencies encoding?

**Interim:** [`DATA-36a`](../decisions/interim/DATA.md) successor-list encoding via Chrome Trace `args`.

### DATA-37 — roofline formulas (was: Q11)

**Status:** `open` + `interim`

**Question:** Roofline formulas?

**Interim:** [`DATA-37a…DATA-37f`](../decisions/interim/DATA.md).
