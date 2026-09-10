# DATA questions

Open **DATA** questions (file/field/formula data mapping). Status enum, prefix taxonomy, and migration map: [README.md](README.md).

## Roofline sub-questions — aliases of DATA-37

The seven **DATA-11…DATA-17** rows below are the granular roofline questions from the HQ/`Q11` batch. They keep permanent ids of their own, but carry the **same status as the [DATA-37](#data-37--roofline-formulas-was-q11) umbrella** and share its findings — ask Product for them together.

### DATA-11 — Roofline axes vs pipe busy rates

<img src="../visual/questions/data-11.png" alt="DATA-11 Roofline chart — not pipe busy rates" width="900" height="655">

**Status:** `open` + `interim` — alias of [DATA-37](#data-37--roofline-formulas-was-q11).

**Question:** The Roofline chart plots **X = Ops/Byte** (arithmetic intensity) and **Y = TOps/s** (achieved performance). The producer doc's Roofline table instead points its three tab labels at **pipe busy rates** — `aic_cube_ratio`, `aic_mte2_ratio`, `aic_mte1_ratio` (`PipeUtilization.csv`). Busy-rate ratios cannot produce either axis, so: what are the real axis quantities, and are the tabs meant to be axes at all, or three separate bottleneck panels?

### DATA-12 — X axis Ops/Byte

<img src="../visual/questions/data-12.png" alt="DATA-12 X axis Ops/Byte" width="900" height="655">

**Status:** `open` + `interim` — alias of [DATA-37](#data-37--roofline-formulas-was-q11).

**Question:** **X axis = Ops/Byte** — which file, field(s), and formula? Does the **GM** point use the same formula and byte source as the **L2** point, or different ones? (Interim [DATA-37b](../decisions/interim/DATA.md): `fops ÷ ((read_main_memory_datas(KB) + write_main_memory_datas(KB)) × 1024)`.)

### DATA-13 — Y axis TOps/s

<img src="../visual/questions/data-13.png" alt="DATA-13 Y axis TOps/s" width="900" height="655">

**Status:** `open` + `interim` — alias of [DATA-37](#data-37--roofline-formulas-was-q11).

**Question:** **Y axis = TOps/s** — which file, field(s), and formula? Raw FLOPS *counts* exist (`aiv_vec_fops`, `aic_cube_fops` on `ArithmeticUtilization.csv`) but there is no documented TOps/s conversion. Is it a per-side (Cube \| Vector) value or one combined number? (Interim [DATA-37a](../decisions/interim/DATA.md): `fops ÷ mean(*_time(us)) ÷ 1e6`.)

### DATA-14 — roof lines

<img src="../visual/questions/data-14.png" alt="DATA-14 roof lines" width="900" height="655">

**Status:** `open` + `interim` — alias of [DATA-37](#data-37--roofline-formulas-was-q11).

**Question:** The two **roof lines** — the bandwidth slope and the compute plateau — which file and fields? Peak compute ([DATA-3](../decisions/DATA.md): `aic/aiv_flops_theoretical`) and peak BW ([DATA-5](../decisions/DATA.md): `aicore_gm_bw_theoretical(GB/s)` = SOL **1600 GB/s**) are documented for the summary cards; nothing states whether the roofline roof reuses those values, or which one applies to which side.

### DATA-15 — L2 bytes

<img src="../visual/questions/data-15.png" alt="DATA-15 L2 legend series" width="900" height="655">

**Status:** `open` + `interim` — alias of [DATA-37](#data-37--roofline-formulas-was-q11).

**Question:** The chart legend has an **L2** series alongside GM, and the L2 point needs **bytes moved through L2**. Which field? `L2Cache.csv` carries hit/miss **counts** and hit **rates** only — no byte traffic. If no byte field exists, should the L2 series be dropped, or taken from another file? (Interim [DATA-37c](../decisions/interim/DATA.md): omit the L2 point.)

### DATA-16 — Vec_FP32 / Vec_MISC mix labels

<img src="../visual/questions/data-16.png" alt="DATA-16 Vec_FP32 / Vec_MISC mix" width="900" height="655">

**Status:** `open` + `interim` — alias of [DATA-37](#data-37--roofline-formulas-was-q11).

**Question:** The op-mix annotation above the plot prints labels such as `Vec_FP32` / `Vec_MISC`. Which file and fields feed them on **Cube vs Vector** ops, and when several mix ratios are non-zero at once, **which labels are shown, in what order, and with how much precision?**

**Answer so far:** Fields exist in `ArithmeticUtilization.csv` — `aiv_vec_{fp32,fp16,int32,int16,misc}_ratio`. The producer dictionary uses *different* names (`aiv_vec_{vf,sfu,simt_vf}_ratio`). The "which to show when many are non-zero" rule is undocumented.

### DATA-17 — Roofline tabs

<img src="../visual/questions/data-17.png" alt="DATA-17 Roofline tabs" width="900" height="655">

**Status:** `open` + `interim` — alias of [DATA-37](#data-37--roofline-formulas-was-q11).

**Question:** Tabs **内存单元** / **内存通路** / **搬运单元** — what does each tab show, and is the tab set in scope at all this iteration (or should the panel stay single-chart)?

**Answer so far:** The producer doc maps 内存单元→`aic_cube_ratio`, 内存通路→`aic_mte2_ratio`, 搬运单元→`aic_mte1_ratio` (all `PipeUtilization.csv`) — the pipe-busy-rate mapping [DATA-11](#data-11--roofline-axes-vs-pipe-busy-rates) flags as wrong. No Product answer. (Interim [DATA-37f](../decisions/interim/DATA.md): hide the tabs.)

### DATA-19 — summary vs 详情 block scope

<img src="../visual/questions/data-19.png" alt="DATA-19 详情 overlay (selected block)" width="900" height="315">

**Status:** `interim`

**Question:** A CSV holds one row per `block_id` (sample: 8 rows). On the **summary** PIPE bars, do we average all blocks? On the **详情** overlays, do we show only the selected block? Does picking a block scope **only PIPE** or every summary widget (cards, Roofline, memory diagram)? The producer reply on the 详情 crop asks for a **block-selection control** there (reference crop [DATA-29](#data-29--same-rule-for-every-widget)); engineering also ships an **All \| block_id** control on the summary — confirm whether that summary control is wanted, and where the selector belongs.

**Interim:** summary PIPE bars default to mean of non-`NA` ratios across `block_id` ([`DATA-33b`](../decisions/interim/DATA.md)); summary **block** control (All \| `block_id`) scopes PIPE when >1 block. **详情** / memory / metrics = selected block ([`DATA-33c`](../decisions/interim/DATA.md)). Matrix: [VIEW_DATA_REQUIREMENTS §8.1](../../formats/VIEW_DATA_REQUIREMENTS.md).

### DATA-20 — Peak(%) box colors

<img src="../visual/questions/data-20.png" alt="DATA-20 Peak(%) on the L2 box" width="900" height="900">

**Status:** `partial`

**Question:** Memory-diagram **boxes and edges** can show a **Peak (%)** badge — the unit's usage as a percent of its theoretical maximum, driving a color scale. For **each box** — GM, L2, L1, L0A, L0B, L0C, Cube, FixP, UB, Vec, Scalar — which file and field gives that percent, and what is the box's 100% reference (theoretical peak)? For each **edge** that carries a 理论值 — L0C → L1 and L0C → L2/GM ([DATA-24](../decisions/DATA.md) / [DATA-25](#data-25--l0c--l2gm)) — same question: which field, and what is the 100% reference? The producer doc's 理论值 column is empty for every row.

**Answer so far:** **L2 box only:** Peak(%) = **hit rate** (命中率) from `L2Cache.csv` (total hit rate per [DATA-21](../decisions/DATA.md)), not a peak-relative percent. Other boxes and both L0C edges — still no Product mapping. Rule 2 of the producer doc also asks how the color scale maps when 理论值 is known.

### DATA-25 — L0C → L2/GM

<img src="../visual/questions/data-25.png" alt="DATA-25 L0C to L2/GM" width="900" height="900">

**Status:** `interim`

**Question:** Show a **L0C → L2/GM** edge on the memory diagram? If yes, the sample provides `Memory.csv` → `L0C_to_GM_datas(KB)` (+ `L0C_to_GM_bw_usage_rate(%)`); confirm the field and the 理论值 (Peak %). The sketch labels one **LOC** source node for L0C → L1, L0C → L2/GM and L0C → UB without distinguishing the three edges — should they be one arrow or three?

**Interim:** show `Memory.csv` → `L0C_to_GM_datas(KB)` when present; no Peak(%).

### DATA-28 — summary aggregation (mean / max / first / selected)

<img src="../visual/questions/data-28.png" alt="DATA-28 summary mean percent column" width="900" height="524">

**Status:** `interim`

**Question:** A CSV often has many `block_id` rows (sample: 8). When one summary number is shown — a PIPE percent, a bandwidth card, a compute score — which aggregation is correct: **mean**, **max**, **first block**, or **selected block**? How are `NA`/empty rows treated, and is the rule the same for every metric?

**Interim:** [`DATA-33b`](../decisions/interim/DATA.md): mean of non-`NA` values across `block_id` for summary PIPE / I/O measured BW. Product note: request a **general aggregation description document**.

### DATA-29 — same rule for every widget?

<img src="../visual/questions/data-29.png" alt="DATA-29 selected block switcher" width="900" height="318">

**Status:** `interim`

**Question:** Does one aggregation rule ([DATA-28](#data-28--summary-aggregation-mean--max--first--selected)) apply to **every** widget — bandwidth / compute / AICore cards, PIPE bars, Roofline, memory diagram — or are there per-surface exceptions? If there are exceptions, list which widget uses which rule (and why).

**Interim:** [`DATA-33c`](../decisions/interim/DATA.md): summary PIPE (and measured BW) stay mean-across-blocks; **详情** / memory diagram / metrics lists are the selected block. Roofline aggregates like [`DATA-33b`](../decisions/interim/DATA.md).

### DATA-31 — authoritative MVP fixture shape (was: Q4)

**Status:** `partial`

**Question:** Which fixture is authoritative for acceptance — the sketch-faithful Gantt (Card → Core → pipe hierarchy), or the flat AIV sample? Is there a golden report file Product will designate, and which properties must match (lane tree, values, chrome) versus which are pixel-cosmetic?

**Answer so far:** Product target = sketch-like Gantt (A). **CI fixture** = `out.rep` until golden — [`DATA-31a`](../decisions/interim/DATA.md).

### DATA-36 — dependencies encoding (was: Q9)

**Status:** `open` + `interim`

**Question:** How does the producer encode the dependency edges between timeline events — which Chrome Trace `args` keys, successor lists or predecessor lists, and how are ids made addressable? Are edges within one lane only, or also cross-lane?

**Interim:** [`DATA-36a`](../decisions/interim/DATA.md) successor-list encoding via Chrome Trace `args`.

### DATA-37 — roofline formulas (was: Q11)

**Status:** `open` + `interim`

**Question:** Which file, field, and formula feeds **each element of the Roofline chart** — X axis (Ops/Byte), Y axis (TOps/s), the GM and L2 measured points, the two roof lines (peak bandwidth + peak compute), the op-mix labels, and the 内存单元 / 内存通路 / 搬运单元 tabs? The producer docs describe the chart's *purpose* but supply no formulas, so all seven sub-questions below are open and should be answered together.

Umbrella for the granular HQ twins retained as aliases: [DATA-11](#data-11--roofline-axes-vs-pipe-busy-rates) (axes vs pipe busy rates), [DATA-12](#data-12--x-axis-opsbyte) (X Ops/Byte), [DATA-13](#data-13--y-axis-topss) (Y TOps/s), [DATA-14](#data-14--roof-lines) (roof peaks), [DATA-15](#data-15--l2-bytes) (L2 bytes), [DATA-16](#data-16--vec_fp32--vec_misc-mix-labels) (mix labels), [DATA-17](#data-17--roofline-tabs) (tabs).

**Known so far (docs checked 2026-09-10):**

- **Axes (DATA-11–13):** not documented. NPU-Compute.md Q11–Q13 have no Product answer; the docx tab→field table (`aic_cube_ratio` / `aic_mte2_ratio` / `aic_mte1_ratio`, `PipeUtilization.csv`) is pipe busy rates, not axes.
- **Roof (DATA-14):** peak compute formulas *do* exist in NPU-Compute.md Q3 (`aic/aiv_flops_theoretical`) and peak BW = `aicore_gm_bw_theoretical` (SOL **1600 GB/s**, Q5), but the docs never wire them to the roofline roof.
- **L2 bytes (DATA-15):** absent — `L2Cache.csv` has hit/miss counts and hit *rates* only.
- **Mix (DATA-16):** fields exist in `ArithmeticUtilization.csv` (`aiv_vec_{fp32,fp16,int32,int16,misc}_ratio`); the docx dictionary uses `aiv_vec_{vf,sfu,simt_vf}_ratio`. The "which to show when many are non-zero" rule is undocumented.
- **Tabs (DATA-17):** docx maps 内存单元/内存通路/搬运单元 to the pipe ratios above — the mapping DATA-11 flags as wrong; no Product answer.

**Interim:** [`DATA-37a…DATA-37f`](../decisions/interim/DATA.md).

### DATA-38 — Card gutter 时钟周期 formula (was: Q24 / HQ 39)

**Status:** `interim`

**Question:** Card-header **时钟周期 / Clock Cycle** gutter bars ([design `entry.jpeg`](../../ui/source/v930/entry.jpeg)) — which file, fields, and formula? Is the value cycle counts, pipe `*_time(us)`, or derived from swimlane events?

**Answer so far (interim):** Quantity = **mean non-`NA` mapped `PipeUtilization.csv` `*_time(us)`** across `block_id`, keyed by `laneColorKey` (not `*_total_cycles`, not per-event average). Relative bar within Card; max-lane red. Selector modes: **clockCycle** + **utilization** only. Interim: [`DATA-38a`](../decisions/interim/DATA.md). Label units: [`UI-46`](UI.md) / [`UI-46a`](../decisions/interim/UI.md). Spec: [gutter-metrics.spec.md](../../../specs/core/gutter-metrics.spec.md). **Not** timeline CPU-clocks display ([UI-45](../decisions/UI.md)).

**PyPTO reference (not shippable on current npu-rep):** sum of `event.pmu_info['total cycle']` after joining `tilefwk_prof_pmu.csv` onto events. Absent from [NPU-Compute.md](https://gitcode.com/wk0911/npu-tools/blob/main/npu-compute/NPU-Compute.md) embeds and from scanned fixtures (`example.npu.rep`, PR #74 packs) — event traces have no `pmu_info` / `"total cycle"`; PR #74 does not add them. Block CSV `*_total_cycles` ≠ that formula.

**Specs when answered:** [METRICS_AND_TRACE](../../formats/METRICS_AND_TRACE.md), [VIEW_DATA_REQUIREMENTS](../../formats/VIEW_DATA_REQUIREMENTS.md), [FEATURE_MATRIX](../../ui/FEATURE_MATRIX.md), [gutter-metrics.spec.md](../../../specs/core/gutter-metrics.spec.md).
