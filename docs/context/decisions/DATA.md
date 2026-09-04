# DATA decisions

Product-final answers to **DATA** questions (file/field/formula data mapping) that have left the open list. Each entry keeps the **same bare id** as its question in [OPEN_QUESTIONS.md](../OPEN_QUESTIONS.md), plus a `Was` reference to the pre-merge id.

Normative truth lives in the owning **specs** (linked per entry); this log is the traceability record, not the source of truth.

Format and statuses: [README.md](README.md).

---

## DATA-1 (was: HQ 1)

- **Resolved:** 2026-09-01
- **Question:** The **N 次迭代 / 核** (N iterations / core) line — which field?
- **Decision:** Label = `OpBasicInfo.csv` `Block Dim` / *core count*, where core count depends on `Op Type`: **cube** → `HardwareInfo.jsonl` `aic_cube_count` (also `ai_cube_count`); **vector** → `ai_vector_count` (also `aic_vector_count`); **mix** → `ai_core_count`.
- **Specs:** [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md), [INTERIM_DECISIONS](../INTERIM_DECISIONS.md) `DATA-33e`
- **Source:** Product answer doc `355b2688f3684479b0b2b038a3b64513.docx` (2026-08-31); implemented in `summary.coreCount` + secondary `{blockDim} / {coreCount}` (`StatsAside.vue`).

---

## DATA-4 (was: HQ 4)

- **Resolved:** 2026-08-31
- **Question:** The **90** (score) — what is the formula? `measured / peak × 100`?
- **Decision:** `score = measured / peak × 100%` per side (cube / vector). Peak from DATA-3.
- **Specs:** [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md)
- **Source:** Product answer doc (2026-08-31).

---

## DATA-18 (was: HQ 18)

- **Resolved:** 2026-08-31
- **Question:** The number **inside** the PIPE bar — time or cycles?
- **Decision:** Show **cost time**: mean of non-`NA` `*_time(us)` for the same family/side as the ratio (`PipeUtilization.csv`). Not cycles.
- **Specs:** [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md), [INTERIM_DECISIONS](../INTERIM_DECISIONS.md) `DATA-33f`
- **Source:** Product answer doc (2026-08-31).

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
- **Specs:** [VIEW_DATA_REQUIREMENTS](../../formats/VIEW_DATA_REQUIREMENTS.md), [INTERIM_DECISIONS](../INTERIM_DECISIONS.md) `DATA-32a`

---

## DATA-34 (was: Q7)

- **Resolved:** 2026-08-20
- **Question:** Hardware details sidebar source?
- **Decision:** **`HardwareInfo.jsonl`** is the details source. Not required to open Timeline; **更多** always opens the overlay — show `hardwareDetails` when present, else **缺少 hardware info**. Aside meta is **进程** / **算子类型** / **Blocks**.
- **Specs:** [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md), [INTERIM_DECISIONS](../INTERIM_DECISIONS.md) `DATA-34a`

---

## DATA-35 (was: Q8)

- **Resolved:** 2026-07-31
- **Question:** Lane hierarchy mapping?
- **Decision:** Producer/stress fixed naming (A); no viewer heuristics inventing Card/Core from AIV pipes. Nested gutter renders explicit `children`.
- **Specs:** [METRICS_AND_TRACE](../../formats/METRICS_AND_TRACE.md)
