# Decisions (resolved open questions)

Product-final answers that have left the open list. Each entry keeps the **same bare id** as its question in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md), plus a `Was` reference to the pre-merge id.

Normative truth lives in the owning **specs** (linked per entry); this log is the traceability record, not the source of truth.

**Statuses:** see [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) — `resolved` is the only status recorded here.

---

## DATA-1 (was: HQ 1)

- **Resolved:** 2026-09-01
- **Question:** The **N 次迭代 / 核** (N iterations / core) line — which field?
- **Decision:** Label = `OpBasicInfo.csv` `Block Dim` / *core count*, where core count depends on `Op Type`: **cube** → `HardwareInfo.jsonl` `aic_cube_count` (also `ai_cube_count`); **vector** → `ai_vector_count` (also `aic_vector_count`); **mix** → `ai_core_count`.
- **Specs:** [VIEW_DATA_MAPPING](../ui/VIEW_DATA_MAPPING.md), [INTERIM_DECISIONS](INTERIM_DECISIONS.md) `DATA-33e`
- **Source:** Product answer doc `355b2688f3684479b0b2b038a3b64513.docx` (2026-08-31); implemented in `summary.coreCount` + secondary `{blockDim} / {coreCount}` (`StatsAside.vue`).

---

## DATA-4 (was: HQ 4)

- **Resolved:** 2026-08-31
- **Question:** The **90** (score) — what is the formula? `measured / peak × 100`?
- **Decision:** `score = measured / peak × 100%` per side (cube / vector). Peak from DATA-3.
- **Specs:** [VIEW_DATA_MAPPING](../ui/VIEW_DATA_MAPPING.md)
- **Source:** Product answer doc (2026-08-31).

---

## DATA-18 (was: HQ 18)

- **Resolved:** 2026-08-31
- **Question:** The number **inside** the PIPE bar — time or cycles?
- **Decision:** Show **cost time**: mean of non-`NA` `*_time(us)` for the same family/side as the ratio (`PipeUtilization.csv`). Not cycles.
- **Specs:** [VIEW_DATA_MAPPING](../ui/VIEW_DATA_MAPPING.md), [INTERIM_DECISIONS](INTERIM_DECISIONS.md) `DATA-33f`
- **Source:** Product answer doc (2026-08-31).

---

## UI-30 (was: HQ 30)

- **Resolved:** 2026-08-31
- **Question:** Must every report include `HardwareInfo.jsonl`?
- **Decision:** **Yes** — every report is expected to include `HardwareInfo.jsonl`. If absent, **更多** still opens and shows **缺少 hardware info**.
- **Specs:** [VIEW_DATA_MAPPING](../ui/VIEW_DATA_MAPPING.md)
- **Source:** Product answer doc (2026-08-31); implemented in `StatsAside.vue`.

---

## UI-31 (was: HQ 31)

- **Resolved:** 2026-08-31
- **Question:** If `HardwareInfo.jsonl` is missing, what happens to **更多** / 硬件信息详情?
- **Decision:** Do **not** hide **更多**. Open overlay and show **缺少 hardware info**.
- **Specs:** [VIEW_DATA_MAPPING](../ui/VIEW_DATA_MAPPING.md)
- **Source:** Product answer doc (2026-08-31); implemented in `StatsAside.vue`.

---

## UI-32 (was: HQ 32)

- **Resolved:** 2026-09-01
- **Question:** The duration bar — decoration or a real percent? Of what?
- **Decision:** Real percent: `Block Dim / core_count × 100%` (core_count per DATA-1). Clamp display at **100%** when ratio exceeds 1.
- **Specs:** [VIEW_DATA_MAPPING](../ui/VIEW_DATA_MAPPING.md), [INTERIM_DECISIONS](INTERIM_DECISIONS.md) `DATA-33e`
- **Source:** Product answer doc (2026-08-31); implemented in `StatsAside.vue`.

---

## UI-33 (was: HQ 33)

- **Resolved:** 2026-08-31
- **Question:** Compute card — one number, or two columns (aic | aiv)?
- **Decision:** **Separate columns** (cube \| vector / aic \| aiv), same layout as the bandwidth cards.
- **Specs:** [VIEW_DATA_MAPPING](../ui/VIEW_DATA_MAPPING.md)
- **Source:** Product answer doc (2026-08-31).

---

## UI-34 (was: HQ 34)

- **Resolved:** 2026-08-31
- **Question:** If measured I/O is small (e.g. `15.8 GB/s`), show **GB/s** or **TB/s**?
- **Decision:** Always **GB/s** (not TB/s).
- **Specs:** [VIEW_DATA_MAPPING](../ui/VIEW_DATA_MAPPING.md), [INTERIM_DECISIONS](INTERIM_DECISIONS.md) `DATA-33g`
- **Source:** Product answer doc (2026-08-31); implemented via `formatGBs()` in `StatsAside.vue`.

---

## UI-35 (was: HQ 35)

- **Resolved:** 2026-08-31
- **Question:** Right-click on the memory diagram — extra details? Which fields?
- **Decision:** **Yes.** Show full CSV tables: **Memory**, **L2Cache**, **MemoryUB**, **MemoryL0** (block-scoped).
- **Specs:** [VIEW_DATA_MAPPING](../ui/VIEW_DATA_MAPPING.md)
- **Source:** Product answer doc (2026-08-31).

---

## UI-43 (was: HQ 37)

- **Resolved:** 2026-08-28
- **Question:** CSV 详情 search — filter only, or filter + highlight?
- **Decision:** **Filter + highlight**: search filters non-matching rows and highlights the matching substring (flush chip), on both compute and memory.
- **Specs:** [CsvFieldListPanel.spec.md](../../src/ui/StatsAside/CsvFieldListPanel/CsvFieldListPanel.spec.md), [UX_SPEC](../ui/UX_SPEC.md)
- **Source:** PR [#52](https://github.com/IdeFrontend/profiling-report/pull/52).

---

## PROC-1 (was: Q1)

- **Resolved:** 2026-07-31
- **Question:** Producer of `.rep` / `.ncrep`?
- **Decision:** Tool WIP. Use the sample `.rep` + [REP_FORMAT](../formats/REP_FORMAT.md) until the producer spec lands.
- **Specs:** [REP_FORMAT](../formats/REP_FORMAT.md)

---

## DATA-30 (was: Q3)

- **Resolved:** 2026-07-31
- **Question:** Required embeds / missing-data behavior?
- **Decision:** Minimal open; **hide** missing panels.
- **Specs:** [VIEW_DATA_REQUIREMENTS](../formats/VIEW_DATA_REQUIREMENTS.md)

---

## DATA-32 (was: Q5)

- **Resolved:** 2026-07-31
- **Question:** Overview charts data source?
- **Decision:** **Hide** overview charts until `OverviewSeries` (C). Adapter returns `[]`.
- **Specs:** [VIEW_DATA_REQUIREMENTS](../formats/VIEW_DATA_REQUIREMENTS.md), [INTERIM_DECISIONS](INTERIM_DECISIONS.md) `DATA-32a`

---

## DATA-34 (was: Q7)

- **Resolved:** 2026-08-20
- **Question:** Hardware details sidebar source?
- **Decision:** **`HardwareInfo.jsonl`** is the details source. Not required to open Timeline; **更多** always opens the overlay — show `hardwareDetails` when present, else **缺少 hardware info**. Aside meta is **进程** / **算子类型** / **Blocks**.
- **Specs:** [VIEW_DATA_MAPPING](../ui/VIEW_DATA_MAPPING.md), [INTERIM_DECISIONS](INTERIM_DECISIONS.md) `DATA-34a`

---

## DATA-35 (was: Q8)

- **Resolved:** 2026-07-31
- **Question:** Lane hierarchy mapping?
- **Decision:** Producer/stress fixed naming (A); no viewer heuristics inventing Card/Core from AIV pipes. Nested gutter renders explicit `children`.
- **Specs:** [METRICS_AND_TRACE](../formats/METRICS_AND_TRACE.md)

---

## UI-38 (was: Q12)

- **Resolved:** 2026-07-31
- **Question:** Memory topology rendering?
- **Decision:** Static SVG + data-driven edge labels.
- **Specs:** [VIEW_DATA_REQUIREMENTS](../formats/VIEW_DATA_REQUIREMENTS.md)

---

## UI-39 (was: Q13)

- **Resolved:** 2026-07-31
- **Question:** Color / category legend?
- **Decision:** Sketch colors are normative — [COLOR_TOKENS](../ui/COLOR_TOKENS.md).
- **Specs:** [COLOR_TOKENS](../ui/COLOR_TOKENS.md)

---

## PROC-3 (was: Q15)

- **Resolved:** 2026-07-31
- **Question:** MSTT `.json` policy?
- **Decision:** Chrome Trace `.json` → profiling-report.
- **Specs:** [MSTT_INTEGRATION](../architecture/MSTT_INTEGRATION.md)

---

## PROC-4 (was: Q20)

- **Resolved:** 2026-08-12
- **Question:** Cursor skills / agent rules location?
- **Decision:** Shared rules in [`AGENTS.md`](../../AGENTS.md) (+ nested `specs/AGENTS.md`, `specs/CLAUDE.md` → `@./AGENTS.md`), skills in `.agents/skills/`. Cursor-only: `.cursor/rules/code-review-post-github.mdc`. Root Claude: [`CLAUDE.md`](../../CLAUDE.md) → `@AGENTS.md`.
- **Specs:** [`AGENTS.md`](../../AGENTS.md), [`CLAUDE.md`](../../CLAUDE.md)

---

## UI-42 (was: Q22)

- **Resolved:** 2026-08-25
- **Question:** Measure mode — recompute the right panel / other views?
- **Decision:** Measure mode does **not** recompute the right panel / other views (local overlay only).
- **Specs:** [INTERACTIONS](../ui/INTERACTIONS.md), [UX_SPEC](../ui/UX_SPEC.md), [VIEW_DATA_REQUIREMENTS](../formats/VIEW_DATA_REQUIREMENTS.md)
