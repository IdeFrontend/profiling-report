# DATA decisions

Product-final answers to **DATA** questions (file/field/formula data mapping) that have left the open list. Each entry keeps the **same bare id** as its question in [questions/](../questions/), plus a `Was` reference to the pre-merge id.

Normative truth lives in the owning **specs** (linked per entry); this log is the traceability record, not the source of truth.

Format and statuses: [README.md](README.md).

---

## DATA-1 (was: HQ 1)

- **Resolved:** 2026-09-01
- **Question:** The **N 次迭代 / 核** (N iterations / core) line — which field?
- **Decision:** Label = `OpBasicInfo.csv` `Block Dim` / *core count*, where core count depends on `Op Type`: **cube** → `HardwareInfo.jsonl` `aic_cube_count` (also `ai_cube_count`); **vector** → `ai_vector_count` (also `aic_vector_count`); **mix** → `ai_core_count`. Duration secondary is `{blockDim} Blocks / {coreCount} 核` (UI-32).
- **Specs:** [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md), [view-models](../../../specs/core/view-models.spec.md)
- **Source:** Product answer doc `355b2688f3684479b0b2b038a3b64513.docx` (2026-08-31); duration secondary wording from NPU-Compute.md (2026-09-04). Implemented in `summary.coreCount` + `{blockDim} Blocks / {coreCount} 核` (`StatsAside.vue`).

---

## DATA-2 (was: HQ 2)

- **Resolved:** 2026-09-04
- **Question:** **172** (measured TFLOPS) — which file, which field(s), and the formula?
- **Decision:** Viewer reads precomputed `summary.jsonl` → `category: OpInfoSummary` → `aic_flops` (AIC) and `aiv_flops` (AIV), split cube \| vector (UI-33). Producer computes these from `ArithmeticUtilization.csv` + `aic/aiv_time(us)`.
- **Specs:** [view-models](../../../specs/core/view-models.spec.md), [npu-rep](../../../specs/core/npu-rep.spec.md)
- **Source:** NPU-Compute.md (2026-09-04); implemented as `summary.aicFlops` / `aivFlops`.

---

## DATA-3 (was: HQ 3)

- **Resolved:** 2026-09-04
- **Question:** **320** (peak TFLOPS) — which file and field? Or a fixed number per chip?
- **Decision:** `summary.jsonl` → `category: OpInfoSummary` → `aic_flops_theoretical` / `aiv_flops_theoretical` (TFLOPS).
- **Specs:** [view-models](../../../specs/core/view-models.spec.md), [npu-rep](../../../specs/core/npu-rep.spec.md)
- **Source:** NPU-Compute.md (2026-09-04); implemented as `summary.aicFlopsTheoretical` / `aivFlopsTheoretical`.

---

## DATA-4 (was: HQ 4)

- **Resolved:** 2026-08-31
- **Question:** The **90** (score) — what is the formula? `measured / peak × 100`?
- **Decision:** `score = measured / peak × 100%` per side (cube / vector). Peak from DATA-3.
- **Specs:** [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md)
- **Source:** Product answer doc (2026-08-31).

---

## DATA-5 (was: HQ 5)

- **Resolved:** 2026-09-04
- **Question:** **1.6 TB/s** (peak) — which file and field?
- **Decision:** Peak = `summary.jsonl` → `category: OpInfoSummary` → `aicore_gm_bw_theoretical(GB/s)` = SOL fixed **1600 GB/s**.
- **Specs:** [view-models](../../../specs/core/view-models.spec.md), [npu-rep](../../../specs/core/npu-rep.spec.md)
- **Source:** NPU-Compute.md (2026-09-04); `bandwidthCardsFromSummary` (fallback 1600).

---

## DATA-6 (was: HQ 6)

- **Resolved:** 2026-09-04
- **Question:** Is the peak the same for aic, aiv, input, and output?
- **Decision:** **Yes** — 1600 GB/s for aic, aiv, input, and output.
- **Specs:** [view-models](../../../specs/core/view-models.spec.md)
- **Source:** NPU-Compute.md (2026-09-04).

---

## DATA-7 (was: HQ 7)

- **Resolved:** 2026-09-04
- **Question:** **81** (score) — what is the formula? It is not `0.08 / 1.6`.
- **Decision:** `score = 实测带宽 / 理论带宽 × 100%` (measured / theoretical). Combined GM uses `(aicore_gm_read_bw + aicore_gm_write_bw) / aicore_gm_bw_theoretical(GB/s)`; per-side uses the matching measured value as numerator.
- **Specs:** [view-models](../../../specs/core/view-models.spec.md)
- **Source:** NPU-Compute.md (2026-09-04).

---

## DATA-9 (was: HQ 9)

- **Resolved:** 2026-09-04
- **Question:** **82%** (average core utilization) — which file, which field, and the formula?
- **Decision:** Card is **AI Core 并行使用率** from `summary.jsonl` → `OpInfoSummary` → `aicore_parallel_utilization` (fraction 0–1). Load balance = `aicore_parallel_balance` (1 − σ/μ across blocks).
- **Specs:** [view-models](../../../specs/core/view-models.spec.md), [npu-rep](../../../specs/core/npu-rep.spec.md)
- **Source:** NPU-Compute.md (2026-09-04); implemented as `summary.parallelUtilization` / `parallelBalance`.

---

## DATA-10 (was: HQ 10)

- **Resolved:** 2026-09-04
- **Question:** **24/24** in **启用 n/m 核** — which field is *n*? Which field is *m*?
- **Decision:** Hide the **启用 n/m 核** label.
- **Specs:** [view-models](../../../specs/core/view-models.spec.md)
- **Source:** NPU-Compute.md (2026-09-04).

---

## DATA-18 (was: HQ 18)

- **Resolved:** 2026-08-31
- **Question:** The number **inside** the PIPE bar — time or cycles?
- **Decision:** Show **cost time**: mean of non-`NA` `*_time(us)` for the same family/side as the ratio (`PipeUtilization.csv`). Not cycles.
- **Specs:** [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md), [decisions/interim/](../decisions/interim/) `DATA-33f`
- **Source:** Product answer doc (2026-08-31).

---

## DATA-21 (was: HQ 21)

- **Resolved:** 2026-09-04
- **Question:** **L2Cache Hit Rate** on the GM↔L2 arrow — read, write, or total? AIC, AIV, or both?
- **Decision:** Use the **total** hit rate from `summary.jsonl` → `category: L2Cache`. When `summary.jsonl` is absent, fall back to the first non-`NA` of `aic_total_hit_rate(%)`, `aiv_total_hit_rate(%)`, `aic_read_hit_rate(%)`, `aiv_read_hit_rate(%)`.
- **Specs:** [npu-rep](../../../specs/core/npu-rep.spec.md)
- **Source:** NPU-Compute.md (2026-09-04).

---

## DATA-26 (was: HQ 26)

- **Resolved:** 2026-09-04
- **Question:** **L0C → UB** — show it? Which field?
- **Decision:** Do **not** show L0C → UB.
- **Specs:** [npu-rep](../../../specs/core/npu-rep.spec.md)
- **Source:** NPU-Compute.md (2026-09-04).

---

## DATA-27 (was: HQ 27)

- **Resolved:** 2026-09-04
- **Question:** Dual-Die / Remote memory — show those arrows? Which fields?
- **Decision:** Do **not** show Dual-Die / remote memory arrows.
- **Specs:** [npu-rep](../../../specs/core/npu-rep.spec.md)
- **Source:** NPU-Compute.md (2026-09-04).

---

## DATA-30 (was: Q3)

- **Resolved:** 2026-07-31
- **Question:** Required embeds / missing-data behavior?
- **Decision:** Minimal open; **hide** missing panels.
- **Specs:** [VIEW_DATA_REQUIREMENTS](../../formats/VIEW_DATA_REQUIREMENTS.md)

---

## DATA-32 (was: Q5)

- **Resolved:** 2026-07-31
- **Question:** Overview charts data source?
- **Decision:** **Hide** overview charts until `OverviewSeries` (C). Adapter returns `[]`.
- **Specs:** [VIEW_DATA_REQUIREMENTS](../../formats/VIEW_DATA_REQUIREMENTS.md), [decisions/interim/](../decisions/interim/) `DATA-32a`

---

## DATA-33 (was: Q6)

- **Resolved:** 2026-09-04
- **Question:** Report summary formulas?
- **Decision:** `summary.jsonl` is canonical. Duration = `OpInfoSummary` `Task Duration(us)`; compute = `aic_flops`/`aiv_flops` (measured) + `aic_flops_theoretical`/`aiv_flops_theoretical` (peak), score = measured/peak×100%; I/O BW = `Memory` category `*_main_mem_{read,write}_bw` with peak `aicore_gm_bw_theoretical(GB/s)` = **1600 GB/s**, score = measured/peak; avg-core-util = **AI Core 并行使用率** (`aicore_parallel_utilization`/`aicore_parallel_balance`). PIPE aggregation remains [`DATA-33b`](interim/DATA.md). Classic `.rep` without `summary.jsonl` keeps CSV fallbacks (`OpBasicInfo.csv`, `Memory.csv`).
- **Specs:** [view-models](../../../specs/core/view-models.spec.md), [npu-rep](../../../specs/core/npu-rep.spec.md)
- **Source:** NPU-Compute.md (2026-09-04). Supersedes interim `DATA-33a`, `DATA-33e`, `DATA-33g`.

---

## DATA-34 (was: Q7)

- **Resolved:** 2026-08-20
- **Question:** Hardware details sidebar source?
- **Decision:** **`HardwareInfo.jsonl`** is the details source. Not required to open Timeline; **更多** always opens the overlay — show `hardwareDetails` when present, else **缺少 hardware info**. Aside meta is **进程** / **算子类型** / **Blocks**.
- **Specs:** [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md), [decisions/interim/](../decisions/interim/) `DATA-34a`

---

## DATA-35 (was: Q8)

- **Resolved:** 2026-07-31
- **Question:** Lane hierarchy mapping?
- **Decision:** Producer/stress fixed naming (A); no viewer heuristics inventing Card/Core from AIV pipes. Nested gutter renders explicit `children`.
- **Specs:** [METRICS_AND_TRACE](../../formats/METRICS_AND_TRACE.md)
