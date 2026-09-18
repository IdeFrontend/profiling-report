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
- **Decision:** **No.** Cards read `summary.jsonl` → `category: OpInfoSummary`: measured read `aicore_gm_read_bw(GB/s)` and measured write `aicore_gm_write_bw(GB/s)`, each the producer's **sum** of the `category: Memory` sides (`aic_main_mem_read_bw + aiv_main_mem_read_bw`, likewise write). Peak = `aicore_gm_bw_theoretical(GB/s)` = SOL **1600 GB/s**, shared by every side (DATA-6). Each direction's 读/写 **score = that direction's measured ÷ peak**. The card does **not** use `aicore_gm_bw_usage_rate(%)`: the producer computes that field independently as the mean of the non-`NA` per-path `GM_to_UB` / `UB_to_GM` / `GM_to_L1` / `L1_to_GM` `_bw_usage_rate(%)` columns, so it is not the 读/写 shares. `Report.csv` is named "SOL/平均带宽" in producer notes but has **no schema** and is unused.
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
- **Decision:** `summary.jsonl` → `category: Memory` → `aiv_ub_to_gm_bw(GB/s)` (the `Memory.csv` column). Do **not** use `MemoryUB.csv` `aiv_ub_read_bw_gm(GB/s)` — it is **not the collected field**: the producer does not emit it (the classic `.rep` sample has no such column; the product sample's `0.0` values are uncollected).
- **Specs:** [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md) §11.2.6, [INPUT_FORMATS](../../formats/INPUT_FORMATS.md) §3.6, [VIEW_DATA_REQUIREMENTS](../../formats/VIEW_DATA_REQUIREMENTS.md) §11
- **Source:** NPU-Compute.md Q22 (2026-09-10); implemented in `memoryTopology.ts`.

---

## DATA-23 (was: HQ 23)

- **Resolved:** 2026-09-10
- **Question:** **L2/GM → UB** — which file and field?
- **Decision:** `summary.jsonl` → `category: Memory` → `aiv_gm_to_ub_bw(GB/s)` (the `Memory.csv` column). Do **not** use `MemoryUB.csv` `aiv_ub_write_bw_gm(GB/s)` — **not the collected field**: the producer does not emit it (the classic `.rep` sample has no such column; the product sample's `0.0` values are uncollected).
- **Specs:** [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md) §11.2.6, [INPUT_FORMATS](../../formats/INPUT_FORMATS.md) §3.6, [VIEW_DATA_REQUIREMENTS](../../formats/VIEW_DATA_REQUIREMENTS.md) §11
- **Source:** NPU-Compute.md Q23 (2026-09-10); implemented in `memoryTopology.ts`.

---

## DATA-24 (was: HQ 24)

- **Resolved:** 2026-09-10
- **Question:** **L0C → L1** — show it? Which field?
- **Decision:** Show `L0C_to_L1_datas(KB)` (`summary.jsonl` → `category: Memory`; the `Memory.csv` column) when present. The edge carries **no 理论值 (Peak %)**: the producer's DATA-39 row `23` (`L0C -> UB + L0C->L1`) is `NA` / `NA`, so there is no field for a 100% reference (the AIC-row half of [DATA-41](../questions/DATA.md) — the row's fixture validation — is what stays open).
- **Specs:** [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md) §11.2.6, [INPUT_FORMATS](../../formats/INPUT_FORMATS.md) §3.4
- **Source:** NPU-Compute.md Q24 (2026-09-10); field re-confirmed by `Questions/DATA questions/DATA questions.md` DATA-24 (2026-09-11); implemented in `memoryTopology.ts`.

---

## DATA-25 (was: HQ 25)

- **Resolved:** 2026-09-11
- **Question:** **L0C → L2/GM** — show it? Which field? Is the sketch's single **LOC** node one arrow or three?
- **Decision:** **Show** the edge. Value = `summary.jsonl` → `category: Memory` → `L0C_to_GM_datas(KB)` (the `Memory.csv` column). The edge carries **no 理论值 (Peak %)**: the producer's DATA-39 row `23` is `NA` / `NA`, so no field holds a 100% reference (the open half of [DATA-41](../questions/DATA.md) is only the AIC-row fixture validation). The LOC node stays a **single** source node; the producer keeps L0C → UB hidden (already [DATA-26](../decisions/DATA.md)) so only L0C → L1 and L0C → L2/GM are drawn.
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
- **Decision:** `summary.jsonl` is canonical. Duration = `OpInfoSummary` `Task Duration(us)`; compute = `aic_flops`/`aiv_flops` (measured) + `aic_flops_theoretical`/`aiv_flops_theoretical` (peak), score = measured/peak×100%; I/O BW = the `OpInfoSummary` sides `aicore_gm_read_bw` / `aicore_gm_write_bw` (the aic + aiv `Memory` sums) with peak `aicore_gm_bw_theoretical(GB/s)` = **1600 GB/s** (see the DATA-8 / DATA-19 / DATA-28 / DATA-29 entries above for the source fields and block scope); avg-core-util = **AI Core 并行使用率** (`aicore_parallel_utilization`/`aicore_parallel_balance`). Classic `.rep` without `summary.jsonl` keeps CSV fallbacks (`OpBasicInfo.csv`, `Memory.csv`).
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
- **Specs:** [METRICS_AND_TRACE](../../formats/compute/METRICS_AND_TRACE.md)

---

## DATA-39

- **Resolved:** 2026-09-08
- **Was:** open question DATA-39 (OverviewSeries producer)
- **Question:** OverviewSeries producer for 统计分析 tracks?
- **Decision:** Product embed = `Sampling.json` (case variants). Emit **one** `OverviewSeries` track for **every** distinct Chrome Trace `ph:"C"` counter `name` present (`id` = `label` = counter `name` as shipped — no rename / invent Vector or 通信). Points: `{ t: ts×1e3 (µs→canonical ns), v: args.value }` for events with a finite `args.value`; points sorted by `t`; series order = first-seen name order. No embed / no `ph:C` → `[]` → **hide** ([DATA-32](./DATA.md)). Do **not** invent series from `PipeUtilization`.
- **Specs:** [VIEW_DATA_REQUIREMENTS](../../formats/VIEW_DATA_REQUIREMENTS.md) §3, [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md) §11.2.7, [METRICS_AND_TRACE](../../formats/compute/METRICS_AND_TRACE.md), [view-models](../../../specs/core/view-models.spec.md) PR-VM-003, [OverviewCharts](../../../src/ui/TimelineView/OverviewCharts/OverviewCharts.spec.md)
- **Source:** Product (2026-09-08). Supersedes interim [`DATA-39a`](interim/DATA.md) and [`DATA-32a`](interim/DATA.md).

---

## DATA-38 (was: Q24 / HQ 39)

- **Resolved:** 2026-09-14
- **Question:** Card-header **时钟周期 / Clock Cycle** gutter bars — which file, fields, and formula? Cycle counts, pipe `*_time(us)`, or swimlane events?
- **Decision:** Card-header dropdown offers **exactly two** modes: **利用率 / Utilization** (Product 耗时占比) and **时钟周期 / Clock Cycles**. **barWidth** is the **same** for both — event coverage over the model span `[minTime, maxTime]` (switching the dropdown changes **labels only**). Utilization label = `` `${barWidth}%` ``. Clock Cycles **label** = absolute pipe clock cycles from mapped `PipeUtilization.csv` `*_total_cycles` (column map in [gutter-metrics.spec.md](../../../specs/core/gutter-metrics.spec.md)); **not** `*_time(us)` as the displayed quantity, **not** wall-time→cycles conversion, **not** event PMU `pmu_info['total cycle']`, **not** timeline CPU-clocks ([UI-45](./UI.md)). When a per-pipe `*_total_cycles` column is absent, **derive** that column as `mean(timeCol) × (mean(side_total_cycles)/mean(side_time(us)))` for the **matching** aic/aiv side, then mean across available columns for MIX keys. Multi-`block_id` aggregation for cycle labels follows [DATA-28](./DATA.md) (mean of non-`NA`). Leaf label = mapped key raw; **folders sum distinct** `laneColorKey` cycle raws among descendant leaves for the **label** only (same-key multi-core siblings count once; folder barWidth stays mean coverage). Concurrent-pipe **oversum** across **distinct** pipes (e.g. VECTOR+SCALAR) on folder labels is **accepted**; N-core copies of one pipe-family column are **not**. `cacheHit` / `task` stay withdrawn. Label units: [UI-46](./UI.md).
- **Specs:** [gutter-metrics.spec.md](../../../specs/core/gutter-metrics.spec.md), [METRICS_AND_TRACE](../../formats/compute/METRICS_AND_TRACE.md), [VIEW_DATA_REQUIREMENTS](../../formats/VIEW_DATA_REQUIREMENTS.md), [FEATURE_MATRIX](../../ui/FEATURE_MATRIX.md), [LaneGutter.spec.md](../../../src/ui/TimelineView/SwimlaneView/LaneGutter/LaneGutter.spec.md)
- **Source:** Product (2026-09-11) confirmed the two-mode selector (时钟周期 + 耗时占比). Product (2026-09-14) confirmed the full formula: absolute mapped `PipeUtilization.csv` `*_total_cycles` labels (per-column derive when missing), shared event-coverage **barWidth**, folder label **sum of distinct pipe keys** (concurrent-pipe oversum accepted; no N-core duplication), and bare cycle integers ([UI-46](./UI.md)). Supersedes interim [`DATA-38a`](interim/DATA.md).

---

## DATA-20

- **Resolved:** 2026-09-14
- **Was:** Peak(%) box colors (open question DATA-20, `partial`)
- **Question:** Which file and field gives the **Peak(%)** badge of each memory-diagram **box** (GM, L2, L1, L0A, L0B, L0C, Cube, FixP, UB, Vec, Scalar) and of each **理论值 edge** (L0C → L1, L0C → L2/GM), and what is the box's/edge's 100% reference?
- **Decision:** **L2 only — and it is not a peak-relative percent.** The L2 plate shows **hit rate** (命中率) from `L2Cache.csv` ([DATA-21](../decisions/DATA.md); first non-`NA` of `aic_total_hit_rate(%)`, `aiv_total_hit_rate(%)`, `aic_read_hit_rate(%)`, `aiv_read_hit_rate(%)`), rendered as `{n}%` in the export's in-box plate under **L2 Cache** via `nodes.l2.peakPct`. **No other unit carries a Peak(%) badge:** the exported chrome has no plate for GM / L1 / L0A / L0B / L0C / Cube / FixP / UB / Vec / Scalar, and the adapter defines no field for one — `TOPOLOGY_PEAK_PLATE_EDGE_ID = 'l2-hit'` is the only peak plate, and `peakPct` is set for the `l2` node only. Whether any other unit *should* show such a badge was split out as [UI-49](./UI.md) — **resolved 2026-09-15** (see the Update below). The **理论值 / 100% reference** half went the same way: it does not exist for the **L0C → L1** / **L0C → L2/GM** edges either, since the producer's DATA-39 row `23` is `NA` / `NA` (2026-09-15) — those slotless KB edges keep their `*_datas(KB)` volume and get no reference rate ([DATA-24](./DATA.md) / [DATA-25](./DATA.md)). The AIC-row field mapping moved to [DATA-41](../questions/DATA.md).
- **Specs:** [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md) §11.2.6, [view-models](../../../specs/core/view-models.spec.md), [MemoryTopologyPanel.spec.md](../../../src/ui/StatsAside/MemoryTopologyPanel/MemoryTopologyPanel.spec.md), [FEATURE_MATRIX](../../ui/FEATURE_MATRIX.md)
- **Source:** Code audit + sketch re-OCR (2026-09-14). **Code:** the export's only in-box plate is the L2 pillar plate, and `peakPct` is produced for `l2` alone — so no other unit *can* render a `%` value, and that (not the sketch) is what makes the shipped truth "L2 only". **Sketch (corrected 2026-09-14):** the earlier reading of this decision — "the only Peak badge in `visual/memory-topology.png` is the L2 pillar plate" — was **wrong**. Re-OCR of the sketch's in-box slots with the crop re-cut tall enough to cover the full 540 units finds **nine** further badges: AIV0/AIV1/AIC Scalar **57.90% / 56.06% / 0.00%**, AIV0/AIV1 SIMT **0.00%**, AIV0/AIV1 SIMD **2.18%**, CUBE **0.00%**, FixP **0.00%**. So the sketch and the panel disagree on nine in-box badges, and the design half of this question is **not** closed — it stays open as [UI-49](./UI.md), together with the fact that the sketch's badges carry no stated 100% reference. (UI-49 was resolved 2026-09-15 — see the Update below.) The same re-audit found link values the export never plated ([DATA-42](./DATA.md), **resolved** 2026-09-15 — no producer field for any of them). Confirmed against the running app on `sample.lite.rep`: the L2 plate (L2 `0.60%`), ten link magnitudes, and — once this decision's own follow-ups shipped — the UI-49 in-box unit badges and the DATA-43 `l2-l1-read` plate. The AIC row's six L0/Cube plates stay blank there (that gap is [DATA-41](../questions/DATA.md)).
- **Update (2026-09-15):** the nine badges' own fields are now known from the producer's DATA-39 table — AIV0/AIV1 `Scalar` = `aiv_scalar_ratio`, AIV0/AIV1 `Vec` = `aiv_vec_ratio`, `Cube` = `aic_cube_ratio` (`PipeUtilization`), the other six `NA` rows. So they are **plain unit-utilization ratios**, not peak-relative percents: the "no stated 100% reference" half of this decision is answered (the reference is the pipe itself, [DATA-28](./DATA.md)). The design half — the chrome has no plate for any of them — was split out as [UI-49](./UI.md) and is **resolved 2026-09-15**: the three fielded units are painted in their own boxes at the sketch's positions (the four field-less positions stay blank), so no unit gains a peak badge.

---

## DATA-40

- **Resolved:** 2026-09-15
- **Was:** topology edge value aggregation vs the BW card (open question DATA-40, `open` + interim [`DATA-40a`](interim/DATA.md))
- **Question:** A memory-diagram **edge** and the **带宽利用率 读/写 card** can describe the same GM↔L2 direction and show different numbers, because the edge took the **first present non-`NA` candidate** (`aic_main_mem_read_bw` before `aiv_main_mem_read_bw`) while the card showed the **sum** of the aic + aiv sides ([DATA-8](./DATA.md)). Which does the plate show — one side, or the summed traffic? And for an edge fed by several candidate columns, is the rule first non-`NA`, the sum, or the mean?
- **Decision:** **The GM↔L2 plates show the aic + aiv sides summed** — the producer's **Main Read** and **Main Write** (DATA-39 rows 31 / 32, at exactly the `gm-l2-read` (74.5, 255.9) and `gm-l2-write` (75.3, 277.8) slots): read = `aic_main_mem_read_bw(GB/s)` + `aiv_main_mem_read_bw(GB/s)`, write = `aic_main_mem_write_bw(GB/s)` + `aiv_main_mem_write_bw(GB/s)`, both from `Memory.csv` / `summary.jsonl` `category: Memory`. The edge and the card therefore agree (same quantity, both `SUMMARY`-style sums). A side that is `NA` contributes nothing to the sum; both `NA` → no label (hide `NA`, show `0` otherwise unchanged). **Every other edge keeps first-present-non-`NA`** — they name one link, not a direction with two producer sides, and no other edge has a summed producer field. `EDGE_MAP` sources gained an `aggregate: 'sum'` mode to express this without a second resolver.
- **Note (producer-doc slip):** row 32 lists Main Write as `aic_main_mem_read_bw + aiv_main_mem_write_bw`; the AIC side is plainly the **write** column (`aic_main_mem_write_bw`), which is also the side of `OpInfoSummary.aicore_gm_write_bw` ([DATA-8](./DATA.md)). Product confirmed the shipped formula (2026-09-15) in [DATA-43](./DATA.md).
- **Specs:** [view-models](../../../specs/core/view-models.spec.md) § Memory topology + PR-VM-011, [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md) §11.2.6, [INPUT_FORMATS](../../formats/INPUT_FORMATS.md) § Memory load, [MemoryTopologyPanel.spec.md](../../../src/ui/StatsAside/MemoryTopologyPanel/MemoryTopologyPanel.spec.md)
- **Source:** Product (2026-09-15) via the producer's `DATA questions` doc, § DATA-39 "Memory" (rows 31 / 32 = **Main Read** / **Main Write**, source `Summary.jsonl -> Memory`). Supersedes interim [`DATA-40a`](interim/DATA.md). Fixture evidence: on `sample.lite.rep` op1 the arrow now prints `1092.00 GB/s` (560 + 532) / `936.00 GB/s` (480 + 456) instead of the AIC half; on `out.rep` the AIC side is `NA`, so the plate keeps reading `16.89 GB/s`.

---

## DATA-42

- **Resolved:** 2026-09-15
- **Was:** open question DATA-42 (link values the sketch stacks and the export never plates)
- **Question:** The sketch paints **16 `GB/s` link positions** the export has no plate for (L2↔UB column in all three rows, the UB↔SIMD column, and below L0C). Which file and field feeds each of them — and is the stack a real requirement (should the export grow one plate per link), or design filler the panel is right to drop?
- **Decision:** **No producer field exists for any of them — the export's 13 plated corridors are the complete set, and the panel is right to drop the rest.** The producer's DATA-39 "Memory" table carries a row per design position with a `字段` / `数据来源` column, and every position that is **not** one of the 13 plated corridors is marked **`NA` / `NA`**: `SIMT VF Write GM` (row 10), `L2Cache -> SIMT` (10'), `FIXP L0C write GM` (11), `UB -> SIMT(DCache)` / `SIMT -> UB(DCache)` (13/14), `UB -> SIMT` / `SIMT -> UB` (15/16), `UB -> SIMD` / `SIMD -> UB` (16'/16''), `L0C -> UB` (17), `L0C -> UB + L0C -> L1` (23), and their `Same No.` repeats (12/12'/18/19/20). The only rows that carry a field are the already-plated links, the three unit-utilization ratios ([UI-49](./UI.md)), and the GM↔L2 pair ([DATA-40](./DATA.md)). So the sketch's extra stack is **not implementable** — there is nothing to read — and the panel keeps drawing exactly the plated corridors. The design-side wording ("no slot") in [MemoryTopologyPanel.spec.md](../../../src/ui/StatsAside/MemoryTopologyPanel/MemoryTopologyPanel.spec.md) already described this outcome; it is now the producer-confirmed one.
- **Specs:** [MemoryTopologyPanel.spec.md](../../../src/ui/StatsAside/MemoryTopologyPanel/MemoryTopologyPanel.spec.md), [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md) §11.2.6, [INPUT_FORMATS](../../formats/INPUT_FORMATS.md)
- **Source:** Product (2026-09-15) via the producer's `DATA questions` doc, § DATA-39 "Memory" (the `字段` / `数据来源` columns; `NA` for every unplated link position). Supersedes the `**No slot**` interim reading in the panel spec. Annotated coverage figure: [`memory-topology-missing-values.png`](../visual/memory-topology-missing-values.png) — every value the export cannot paint, marked on the official chrome (the nine in-box badges in red, the unplated link stack in orange, the panel's own blank AIC-row slots in blue).

---

## DATA-43

- **Resolved:** 2026-09-15
- **Was:** open question DATA-43 (the DATA-39 "Memory" table's two row slips)
- **Question:** Two rows of the producer's DATA-39 "Memory" table contradict the column map the rest of the table (and our adapter) uses, and they decide two shipped values. **(1)** Row `24` — `GM -> UB`, `aiv_gm_to_ub_bw(GB/s)` — its number sits on the AIC row's corridor plate at `(159.7, 235.5)`, the slot the chrome draws as `L2 → MTE2 → L1` and `EDGE_MAP` fed `aic_l1_read_bw(GB/s)`, while [DATA-23](./DATA.md) already gives `aiv_gm_to_ub_bw` to the two AIV `l2-ub` plates. Which is right for that plate? **(2)** Row `32` — `Main Write` = `aic_main_mem_read_bw + aiv_main_mem_write_bw`: is the AIC `read` column a slip, or is it genuinely part of Main Write?
- **Decision:**
  1. **Use the producer's field on the chrome's own slot.** The AIC-row corridor plate (`l2-l1-read`) reads `Memory.csv` `aiv_gm_to_ub_bw(GB/s)` — the same `GM -> UB` field the two AIV `l2-ub` plates carry ([DATA-23](./DATA.md)) — and is painted where the SVG chrome puts it ("display it according to svg spec"). **Slot and direction are unchanged** (`from: l2`, `to: l1`; the chrome still draws `L2 → MTE2 → L1`); only the value source moved, so the AIC row shows a third `aiv_gm_to_ub_bw` plate instead of a unique `aic_l1_read_bw` one. `aic_l1_read_bw(GB/s)` therefore feeds **no** plate — it stays visible in the Memory.csv 详情 **CSV field list** — and a block whose only populated column is that one has no drawable label (no change to `hasDrawableTopology`).
  2. **Main Write is the summed write sides**, exactly as shipped: `aic_main_mem_write_bw(GB/s)` + `aiv_main_mem_write_bw(GB/s)` ([DATA-40](./DATA.md)). The row-32 `read` column is a producer-doc slip.
- **Specs:** [view-models](../../../specs/core/view-models.spec.md) PR-VM-011 / PR-VM-024, [MemoryTopologyPanel.spec.md](../../../src/ui/StatsAside/MemoryTopologyPanel/MemoryTopologyPanel.spec.md) (`l2-l1-read` slot note), [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md) §11.2.6, [INPUT_FORMATS](../../formats/INPUT_FORMATS.md) §3.4
- **Source:** Product (2026-09-15), answering the two items of the DATA-43 question. Row `24` placement evidence: the producer's numbered figure `npu-compute/Questions/DATA questions/图片和附件/image 5.png` (the `24` box OCRs at `(160, 236)` — the `l2-l1-read` slot — beside the grey `MTE2 -> …` link label). Row `32` corroboration: `OpInfoSummary.aicore_gm_write_bw` is the AIC **write** side ([DATA-8](./DATA.md)). Implemented as `EDGE_MAP` `l2-l1-read` → `Memory.csv` `aiv_gm_to_ub_bw(GB/s)`. A **third** row inconsistency found while processing this table — rows `21`/`22` label the Cube↔L0C pair in the opposite direction to rows `29`/`30` for the same two fields — is filed separately as [DATA-44](../questions/DATA.md); the shipped mapping follows rows `29`/`30` (and the `*_write_bw_cube` / `*_read_bw_cube` suffix rule) in the meantime.

---

## DATA-47

- **Resolved:** 2026-09-18
- **Was:** open question DATA-47 (Emulate KernelInfo → summary cards)
- **Question:** Which `KernelInfo.csv` attributes map to `ReportViewModel.summary` for emulate Sept 30 (op name, type, `taskDurationUs`, block dim, pid)? Exact formulas for ticks → `taskDurationUs` when frequency is absent?
- **Decision:** Emulate does **not** drive summary cards or the pid / 算子类型 / Blocks / 更多 meta header. `adaptEmulate` leaves `reportModel.summary` empty and sets `profile: 'emulate'`; `StatsAside` omits the card group and meta row entirely (including summary CANNBot). KernelInfo may still be packed for catalog detection / `csvTexts`, but it does **not** map into summary chrome. Compute packs keep UI-30/31 **更多** and summary cards unchanged.
- **Specs:** [adapt-emulate](../../../specs/core/adapt-emulate.spec.md) PR-ASIM-005, [StatsAside.spec.md](../../../src/ui/StatsAside/StatsAside.spec.md) PR-STATS-007b, [report-summary](../../views/report-summary.md), [emulate/FORMAT](../../formats/emulate/FORMAT.md), [ADAPTERS](../../formats/ADAPTERS.md), [view-models](../../../specs/core/view-models.spec.md)
- **Source:** Product (2026-09-18). Supersedes interim [`DATA-47a`](interim/DATA.md).

