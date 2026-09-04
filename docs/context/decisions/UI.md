# UI decisions

Product-final answers to **UI** questions (presentation / UX) that have left the open list. Each entry keeps the **same bare id** as its question in [questions/](../questions/), plus a `Was` reference to the pre-merge id.

Normative truth lives in the owning **specs** (linked per entry); this log is the traceability record, not the source of truth.

Format and statuses: [README.md](README.md).

---

## UI-30 (was: HQ 30)

- **Resolved:** 2026-08-31
- **Question:** Must every report include `HardwareInfo.jsonl`?
- **Decision:** **Yes** — every report is expected to include `HardwareInfo.jsonl`. If absent, **更多** still opens and shows **缺少 hardware info**.
- **Specs:** [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md)
- **Source:** Product answer doc (2026-08-31); implemented in `StatsAside.vue`.

---

## UI-31 (was: HQ 31)

- **Resolved:** 2026-08-31
- **Question:** If `HardwareInfo.jsonl` is missing, what happens to **更多** / 硬件信息详情?
- **Decision:** Do **not** hide **更多**. Open overlay and show **缺少 hardware info**.
- **Specs:** [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md)
- **Source:** Product answer doc (2026-08-31); implemented in `StatsAside.vue`.

---

## UI-32 (was: HQ 32)

- **Resolved:** 2026-09-01
- **Question:** The duration bar — decoration or a real percent? Of what?
- **Decision:** Real percent: `Block Dim / core_count × 100%` (core_count per DATA-1). Clamp display at **100%** when ratio exceeds 1.
- **Specs:** [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md), [INTERIM_DECISIONS](../INTERIM_DECISIONS.md) `DATA-33e`
- **Source:** Product answer doc (2026-08-31); implemented in `StatsAside.vue`.

---

## UI-33 (was: HQ 33)

- **Resolved:** 2026-08-31
- **Question:** Compute card — one number, or two columns (aic | aiv)?
- **Decision:** **Separate columns** (cube \| vector / aic \| aiv), same layout as the bandwidth cards.
- **Specs:** [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md)
- **Source:** Product answer doc (2026-08-31).

---

## UI-34 (was: HQ 34)

- **Resolved:** 2026-08-31
- **Question:** If measured I/O is small (e.g. `15.8 GB/s`), show **GB/s** or **TB/s**?
- **Decision:** Always **GB/s** (not TB/s).
- **Specs:** [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md), [INTERIM_DECISIONS](../INTERIM_DECISIONS.md) `DATA-33g`
- **Source:** Product answer doc (2026-08-31); implemented via `formatGBs()` in `StatsAside.vue`.

---

## UI-35 (was: HQ 35)

- **Resolved:** 2026-08-31
- **Question:** Right-click on the memory diagram — extra details? Which fields?
- **Decision:** **Yes.** Show full CSV tables: **Memory**, **L2Cache**, **MemoryUB**, **MemoryL0** (block-scoped).
- **Specs:** [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md)
- **Source:** Product answer doc (2026-08-31).

---

## UI-38 (was: Q12)

- **Resolved:** 2026-07-31
- **Question:** Memory topology rendering?
- **Decision:** Static SVG + data-driven edge labels.
- **Specs:** [VIEW_DATA_REQUIREMENTS](../../formats/VIEW_DATA_REQUIREMENTS.md)

---

## UI-39 (was: Q13)

- **Resolved:** 2026-07-31
- **Question:** Color / category legend?
- **Decision:** Sketch colors are normative — [COLOR_TOKENS](../../ui/COLOR_TOKENS.md).
- **Specs:** [COLOR_TOKENS](../../ui/COLOR_TOKENS.md)

---

## UI-42 (was: Q22)

- **Resolved:** 2026-08-25
- **Question:** Measure mode — recompute the right panel / other views?
- **Decision:** Measure mode does **not** recompute the right panel / other views (local overlay only).
- **Specs:** [INTERACTIONS](../../ui/INTERACTIONS.md), [UX_SPEC](../../ui/UX_SPEC.md), [VIEW_DATA_REQUIREMENTS](../../formats/VIEW_DATA_REQUIREMENTS.md)

---

## UI-43 (was: HQ 37)

- **Resolved:** 2026-08-28
- **Question:** CSV 详情 search — filter only, or filter + highlight?
- **Decision:** **Filter + highlight**: search filters non-matching rows and highlights the matching substring (flush chip), on both compute and memory.
- **Specs:** [CsvFieldListPanel.spec.md](../../../src/ui/StatsAside/CsvFieldListPanel/CsvFieldListPanel.spec.md), [UX_SPEC](../../ui/UX_SPEC.md)
- **Source:** PR [#52](https://github.com/IdeFrontend/profiling-report/pull/52).
