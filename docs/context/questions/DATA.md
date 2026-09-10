# DATA questions

Open **DATA** questions (file/field/formula data mapping). Status enum, prefix taxonomy, and migration map: [README.md](README.md).

### DATA-11 — Roofline axes vs pipe busy rates

**Status:** `open` — granular alias tracked by [DATA-37](#data-37--roofline-formulas-was-q11).

### DATA-12 — X axis Ops/Byte

**Status:** `open` — granular alias tracked by [DATA-37](#data-37--roofline-formulas-was-q11).

### DATA-13 — Y axis TOps/s

**Status:** `open` — granular alias tracked by [DATA-37](#data-37--roofline-formulas-was-q11).

### DATA-14 — roof lines

**Status:** `open` — granular alias tracked by [DATA-37](#data-37--roofline-formulas-was-q11).

### DATA-15 — L2 bytes

**Status:** `open` — granular alias tracked by [DATA-37](#data-37--roofline-formulas-was-q11).

### DATA-16 — Vec_FP32 / Vec_MISC mix labels

**Status:** `partial` — granular alias tracked by [DATA-37](#data-37--roofline-formulas-was-q11).

### DATA-17 — Roofline tabs

**Status:** `partial` — granular alias tracked by [DATA-37](#data-37--roofline-formulas-was-q11).

### DATA-19 — summary vs 详情 block scope

<img src="../visual/questions/data-19.png" alt="DATA-19 详情 overlay (selected block)" width="900" height="315">

**Status:** `interim`

**Question:** On the summary bars, do we average all blocks? On **详情**, do we show only the selected block?

**Interim:** summary PIPE bars default to mean of non-`NA` ratios across `block_id` ([`DATA-33b`](../decisions/interim/DATA.md)); summary **block** control (All \| `block_id`) scopes PIPE when >1 block. **详情** / memory / metrics = selected block ([`DATA-33c`](../decisions/interim/DATA.md)). Matrix: [VIEW_DATA_REQUIREMENTS §8.1](../../formats/VIEW_DATA_REQUIREMENTS.md).

### DATA-20 — Peak(%) box colors

<img src="../visual/questions/data-20.png" alt="DATA-20 Peak(%) on the L2 box" width="900" height="900">

**Status:** `partial`

**Question:** **Peak (%)** color on each memory-diagram box — which file and field for each box?

**Answer so far:** **L2 box only:** Peak(%) = **hit rate** (命中率) from `L2Cache.csv` (total hit rate per [DATA-21](../decisions/DATA.md)). Other boxes (GM, L1, L0*, Cube, FixP, UB, Vec, Scalar) — still no Product mapping.

### DATA-25 — L0C → L2/GM

<img src="../visual/questions/data-25.png" alt="DATA-25 L0C to L2/GM" width="900" height="900">

**Status:** `interim`

**Question:** **L0C → L2/GM** — show it? Which field? (`L0C_to_GM_datas(KB)`?)

**Interim:** show `Memory.csv` → `L0C_to_GM_datas(KB)` when present. Same **LOC** node as L0C → L1.

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

### DATA-36 — dependencies encoding (was: Q9)

**Status:** `open` + `interim`

**Question:** Dependencies encoding?

**Interim:** [`DATA-36a`](../decisions/interim/DATA.md) successor-list encoding via Chrome Trace `args`.

### DATA-37 — roofline formulas (was: Q11)

**Status:** `open` + `interim`

**Question:** Roofline formulas? Umbrella for the granular HQ twins retained as aliases: [DATA-11](#data-11--roofline-axes-vs-pipe-busy-rates) (axes vs pipe busy rates), [DATA-12](#data-12--x-axis-opsbyte) (X Ops/Byte), [DATA-13](#data-13--y-axis-topss) (Y TOps/s), [DATA-14](#data-14--roof-lines) (roof peaks), [DATA-15](#data-15--l2-bytes) (L2 bytes), [DATA-16](#data-16--vec_fp32--vec_misc-mix-labels) (mix labels), [DATA-17](#data-17--roofline-tabs) (tabs).

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
