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

## DATA-8 (was: HQ 8)

- **Resolved:** 2026-09-10
- **Question:** Do the I/O bandwidth cards come from `Report.csv`? If yes, list the column names.
- **Decision:** **No.** Cards read `summary.jsonl` → `category: OpInfoSummary`: measured read `aicore_gm_read_bw(GB/s)` and measured write `aicore_gm_write_bw(GB/s)` — each the **sum** of the `category: Memory` sides (`aic_main_mem_read_bw + aiv_main_mem_read_bw`, likewise write), **not** their mean — peak `aicore_gm_bw_theoretical(GB/s)` = SOL **1600 GB/s**, shared by every side (DATA-6), and usage `aicore_gm_bw_usage_rate(%)` = `(read + write) / theoretical`. Each direction's 读/写 share uses that direction's measured value as the numerator. `Report.csv` is named "SOL/平均带宽" in producer notes but has **no schema** and is unused.
- **Specs:** [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md) §11.2.3, [VIEW_DATA_REQUIREMENTS](../../formats/VIEW_DATA_REQUIREMENTS.md) §7, [view-models](../../../specs/core/view-models.spec.md), [StatsAside.spec.md](../../../src/ui/StatsAside/StatsAside.spec.md)
- **Source:** `npu-compute性能优化.docx` 报告统计信息 table + NPU-Compute.md Q5–Q7 (2026-09-10); exact field list re-confirmed by `Questions/DATA questions/DATA questions.md` DATA-8 and `Questions/NPU-Compute.md` Q5/Q7 (2026-09-11).

---

## DATA-9 (was: HQ 9)

- **Resolved:** 2026-09-04
- **Question:** **82%** (average core utilization) — which file, which field, and the formula?
- **Decision:** Card is **AI Core 并行使用率** from `summary.jsonl` → `OpInfoSummary` → `aicore_parallel_utilization` (fraction 0–1). Load balance = `aicore_parallel_balance` (1 − σ/μ across blocks). UI: dual columns on the AICore card.
- **Specs:** [view-models](../../../specs/core/view-models.spec.md), [npu-rep](../../../specs/core/npu-rep.spec.md), [StatsAside](../../../src/ui/StatsAside/StatsAside.spec.md) (PR-STATS-011c)
- **Source:** NPU-Compute.md (2026-09-04); implemented as `summary.parallelUtilization` / `parallelBalance`.

---

## DATA-10 (was: HQ 10)

- **Resolved:** 2026-09-04
- **Question:** **启用 n/m 核** / sketch **负载均衡度** — which fields?
- **Decision:** Hide the former **启用 n/m 核** label. Sketch **负载均衡度** = `summary.jsonl` `OpInfoSummary` `aicore_parallel_balance` (fraction 0–1), shown as a dual column beside **并行使用率** on the AICore card (same chrome as BW 读\|写).
- **Specs:** [view-models](../../../specs/core/view-models.spec.md), [npu-rep](../../../specs/core/npu-rep.spec.md), [StatsAside](../../../src/ui/StatsAside/StatsAside.spec.md) (PR-STATS-011c)
- **Source:** NPU-Compute.md (2026-09-04); implemented as `summary.parallelBalance`.

---

## DATA-18 (was: HQ 18)

- **Resolved:** 2026-08-31
- **Question:** The number **inside** the PIPE bar — time or cycles?
- **Decision:** Show **cost time**: mean of non-`NA` `*_time(us)` for the same family/side as the ratio (`PipeUtilization.csv`). Not cycles.
- **Specs:** [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md), [decisions/interim/](../decisions/interim/) `DATA-33f`
- **Source:** Product answer doc (2026-08-31).

---

## DATA-19 (was: HQ 19)

- **Resolved:** 2026-09-11
- **Question:** A CSV holds one row per `block_id`. On the summary PIPE bars, do we average all blocks? On the 详情 overlays, only the selected block? Does picking a block scope **only PIPE** or every summary widget?
- **Decision:** **One block selector, one scope.** Every surface carries a block selector with options **All | 0 | 1 | 2 …** (one per `block_id`), default **All**. **`All`** reads the aggregate from `summary.jsonl` (`category: PipeUtilization`); a specific id reads **that block's row** from the per-block CSV (`PipeUtilization.csv`). The selector scopes **every** summary and detail widget — not PIPE alone. The aggregation used for `All` is [DATA-28](../decisions/DATA.md); the shared per-widget rule is [DATA-29](../decisions/DATA.md).
- **Specs:** [VIEW_DATA_REQUIREMENTS](../../formats/VIEW_DATA_REQUIREMENTS.md) §8.1, [view-models](../../../specs/core/view-models.spec.md), [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md) §11.2
- **Source:** `npu-tools` `Questions/DATA questions/DATA questions.md` DATA-19 (2026-09-11).

---

## DATA-21 (was: HQ 21)

- **Resolved:** 2026-09-04
- **Question:** **L2Cache Hit Rate** on the GM↔L2 arrow — read, write, or total? AIC, AIV, or both?
- **Decision:** Use the **total** hit rate from `summary.jsonl` → `category: L2Cache`. When `summary.jsonl` is absent, fall back to the first non-`NA` of `aic_total_hit_rate(%)`, `aiv_total_hit_rate(%)`, `aic_read_hit_rate(%)`, `aiv_read_hit_rate(%)`.
- **Specs:** [npu-rep](../../../specs/core/npu-rep.spec.md)
- **Source:** NPU-Compute.md (2026-09-04).

---

## DATA-22 (was: HQ 22)

- **Resolved:** 2026-09-10
- **Question:** **UB → L2/GM** — which file and field?
- **Decision:** `summary.jsonl` → `category: Memory` → `aiv_ub_to_gm_bw(GB/s)` (the `Memory.csv` column). Do **not** use `MemoryUB.csv` `aiv_ub_read_bw_gm(GB/s)` — it is absent from the sample and is not the collected field.
- **Specs:** [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md) §11.2.6, [INPUT_FORMATS](../../formats/INPUT_FORMATS.md) §3.6, [VIEW_DATA_REQUIREMENTS](../../formats/VIEW_DATA_REQUIREMENTS.md) §11
- **Source:** NPU-Compute.md Q22 (2026-09-10); implemented in `memoryTopology.ts`.

---

## DATA-23 (was: HQ 23)

- **Resolved:** 2026-09-10
- **Question:** **L2/GM → UB** — which file and field?
- **Decision:** `summary.jsonl` → `category: Memory` → `aiv_gm_to_ub_bw(GB/s)` (the `Memory.csv` column). Do **not** use `MemoryUB.csv` `aiv_ub_write_bw_gm(GB/s)` — absent from the sample.
- **Specs:** [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md) §11.2.6, [INPUT_FORMATS](../../formats/INPUT_FORMATS.md) §3.6, [VIEW_DATA_REQUIREMENTS](../../formats/VIEW_DATA_REQUIREMENTS.md) §11
- **Source:** NPU-Compute.md Q23 (2026-09-10); implemented in `memoryTopology.ts`.

---

## DATA-24 (was: HQ 24)

- **Resolved:** 2026-09-10
- **Question:** **L0C → L1** — show it? Which field?
- **Decision:** Show `L0C_to_L1_datas(KB)` (`summary.jsonl` → `category: Memory`; the `Memory.csv` column) when present. The Product 理论值 (Peak %) for this edge is still 待确定 and tracked by [DATA-20](../questions/DATA.md).
- **Specs:** [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md) §11.2.6, [INPUT_FORMATS](../../formats/INPUT_FORMATS.md) §3.4
- **Source:** NPU-Compute.md Q24 (2026-09-10); field re-confirmed by `Questions/DATA questions/DATA questions.md` DATA-24 (2026-09-11); implemented in `memoryTopology.ts`.

---

## DATA-25 (was: HQ 25)

- **Resolved:** 2026-09-11
- **Question:** **L0C → L2/GM** — show it? Which field? Is the sketch's single **LOC** node one arrow or three?
- **Decision:** **Show** the edge. Value = `summary.jsonl` → `category: Memory` → `L0C_to_GM_datas(KB)` (the `Memory.csv` column). The 理论值 (Peak %) for this edge is **not** answered and is tracked by [DATA-20](../questions/DATA.md). The LOC node stays a **single** source node; the producer keeps L0C → UB hidden (already [DATA-26](../decisions/DATA.md)) so only L0C → L1 and L0C → L2/GM are drawn.
- **Specs:** [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md) §11.2.6, [INPUT_FORMATS](../../formats/INPUT_FORMATS.md) §3.4, [view-models](../../../specs/core/view-models.spec.md)
- **Source:** `npu-tools` `Questions/DATA questions/DATA questions.md` DATA-25 (2026-09-11); implemented in `memoryTopology.ts`.

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

## DATA-28 (was: HQ 28)

- **Resolved:** 2026-09-11
- **Question:** A CSV often has many `block_id` rows. For a single summary number, which aggregation is correct — **mean**, **max**, **first block**, or **selected block**? How are `NA`/empty rows treated?
- **Decision:** Use the `summary.jsonl` aggregate. By its producer definition (`summarize_npu_rep.py`) the default is the **mean of non-`NA` values across `block_id`**; `--block N` takes that block's row verbatim (no aggregation). `NA`/empty values stay the string `"NA"` and are excluded from the mean; identical rows are deduped. A specific block therefore comes from that block's CSV row, and `All` from the summary ([DATA-19](../decisions/DATA.md) / [DATA-29](../decisions/DATA.md)). Compute-load families are shown **Cube and Vector separately** — Cube `aic_cube_ratio` / `aic_mte2_ratio` / `aic_mte1_ratio` / `aic_fixpipe_ratio` / `aic_scalar_ratio`, Vector `aiv_vec_ratio` / `aiv_mte2_ratio` / `aiv_mte3_ratio` / `aiv_scalar_ratio`, all from `summary.jsonl` `category: PipeUtilization`. The producer still wants a general aggregation-description doc; no rule here changes if that lands.
- **Specs:** [VIEW_DATA_REQUIREMENTS](../../formats/VIEW_DATA_REQUIREMENTS.md) §8 / §8.1, [view-models](../../../specs/core/view-models.spec.md)
- **Source:** `npu-tools` `Questions/DATA questions/DATA questions.md` DATA-28 and `Questions/NPU-Compute.md` § summary.jsonl (2026-09-11).

---

## DATA-29 (was: HQ 29)

- **Resolved:** 2026-09-11
- **Question:** Does one aggregation rule apply to **every** widget (cards, PIPE, Roofline, memory diagram), or are there per-surface exceptions?
- **Decision:** **One consistent rule, no exceptions.** Every widget uses the same block selector (**All | 0 | 1 | 2 …**, default **All**): `All` sources `summary.jsonl`, a specific id sources that block's CSV row ([DATA-19](../decisions/DATA.md)), with the `All` aggregation of [DATA-28](../decisions/DATA.md). This replaces the earlier split ("summary stays mean-across-blocks, detail is block-scoped").
- **Specs:** [VIEW_DATA_REQUIREMENTS](../../formats/VIEW_DATA_REQUIREMENTS.md) §8.1, [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md) §11.2, [view-models](../../../specs/core/view-models.spec.md)
- **Source:** `npu-tools` `Questions/DATA questions/DATA questions.md` DATA-29 (2026-09-11).

---

## DATA-30 (was: Q3)

- **Resolved:** 2026-07-31
- **Question:** Required embeds / missing-data behavior?
- **Decision:** Minimal open; **hide** missing panels.
- **Specs:** [VIEW_DATA_REQUIREMENTS](../../formats/VIEW_DATA_REQUIREMENTS.md)

---

## DATA-32 (was: Q5)

- **Resolved:** 2026-07-31 (wording refreshed 2026-09-09)
- **Question:** Overview charts data source?
- **Decision:** **Hide** overview charts when `overviewSeries` is empty. When Sampling.json has usable `ph:C` counters, [DATA-39](./DATA.md) fills the series; otherwise the adapter returns `[]` and the block stays hidden.
- **Specs:** [VIEW_DATA_REQUIREMENTS](../../formats/VIEW_DATA_REQUIREMENTS.md), [DATA-39](./DATA.md)

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

---

## DATA-39

- **Resolved:** 2026-09-08
- **Was:** open question DATA-39 (OverviewSeries producer)
- **Question:** OverviewSeries producer for 统计分析 tracks?
- **Decision:** Product embed = `Sampling.json` (case variants). Emit **one** `OverviewSeries` track for **every** distinct Chrome Trace `ph:"C"` counter `name` present (`id` = `label` = counter `name` as shipped — no rename / invent Vector or 通信). Points: `{ t: ts×1e3 (µs→canonical ns), v: args.value }` for events with a finite `args.value`; points sorted by `t`; series order = first-seen name order. No embed / no `ph:C` → `[]` → **hide** ([DATA-32](./DATA.md)). Do **not** invent series from `PipeUtilization`.
- **Specs:** [VIEW_DATA_REQUIREMENTS](../../formats/VIEW_DATA_REQUIREMENTS.md) §3, [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md) §11.2.7, [METRICS_AND_TRACE](../../formats/METRICS_AND_TRACE.md), [view-models](../../../specs/core/view-models.spec.md) PR-VM-003, [OverviewCharts](../../../src/ui/TimelineView/OverviewCharts/OverviewCharts.spec.md)
- **Source:** Product (2026-09-08). Supersedes interim [`DATA-39a`](interim/DATA.md) and [`DATA-32a`](interim/DATA.md).
