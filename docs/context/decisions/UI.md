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

- **Resolved:** 2026-09-04 (updated; first answered 2026-09-01)
- **Question:** The duration bar — decoration or a real percent? Of what?
- **Decision:** **Remove the bar.** Show `{blockDim} Blocks / {coreCount} 核` as text (core count per DATA-1). If only `blockDim` is set, `{blockDim} Blocks`; else `opName`.
- **Specs:** [view-models](../../../specs/core/view-models.spec.md), [npu-rep](../../../specs/core/npu-rep.spec.md)
- **Source:** NPU-Compute.md (2026-09-04); implemented in `StatsAside.vue` (`PR-STATS-009`, `PR-STATS-031`).

---

## UI-33 (was: HQ 33)

- **Resolved:** 2026-08-31
- **Question:** Compute card — one number, or two columns (aic | aiv)?
- **Decision:** **Separate columns** (cube \| vector), same dual-column pattern as bandwidth. Sketch labels **Cube \| Vector** (adapter sides `aic`/`aiv`).
- **Specs:** [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md), [decisions/interim/](interim/) `DATA-33h`
- **Source:** Product answer doc (2026-08-31); implemented in `StatsAside.vue`.

---

## UI-34 (was: HQ 34)

- **Resolved:** 2026-08-31
- **Question:** If measured I/O is small (e.g. `15.8 GB/s`), show **GB/s** or **TB/s**?
- **Decision:** Always **GB/s** (not TB/s).
- **Specs:** [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md), [decisions/interim/](../decisions/interim/) `DATA-33g`
- **Source:** Product answer doc (2026-08-31); implemented via `formatGBs()` in `StatsAside.vue`.

---

## UI-35 (was: HQ 35)

- **Resolved:** 2026-08-31
- **Question:** Right-click on the memory diagram — extra details? Which fields?
- **Decision:** **Yes.** Show full CSV tables: **Memory**, **L2Cache**, **MemoryUB**, **MemoryL0** (block-scoped).
- **Specs:** [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md), [MemoryTopologyPanel](../../../src/ui/StatsAside/MemoryTopologyPanel/MemoryTopologyPanel.spec.md) (PR-MEMTOP-008), [StatsAside](../../../src/ui/StatsAside/StatsAside.spec.md) (PR-STATS-017b)
- **Source:** Product answer doc (2026-08-31).

---

## UI-36 (was: HQ 36)

- **Resolved:** 2026-09-04
- **Question:** Some labels are **KB**, some **GB/s**. Keep both, or convert to one unit?
- **Decision:** Keep **GB/s** on bandwidth arrows; L0C datas (`L0C_to_L1_datas(KB)` etc.) keep KB.
- **Specs:** [npu-rep](../../../specs/core/npu-rep.spec.md)
- **Source:** NPU-Compute.md (2026-09-04).

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

## UI-41 (was: Q19)

- **Resolved:** 2026-09-03
- **Question:** Gesture parity?
- **Decision:** W/S/A/D zoom/pan (cursor-anchored zoom, 30 px pan) + Ctrl+left-drag pan + trackpad pinch zoom / two-finger horizontal pan (native `wheel`: `ctrlKey` zoom; `|deltaX| > |deltaY|` pan) + 快捷键说明 shortcut-help popover with PyPTO glyphs including trackpad stand-ins. Search Enter/prev-next jump deferred to a separate branch.
- **Specs:** [INTERACTIONS](../../ui/INTERACTIONS.md), [view-state.spec.md](../../../specs/core/view-state.spec.md), [ReportToolbar.spec.md](../../../src/ui/ReportToolbar/ReportToolbar.spec.md)
- **Source:** Product acceptance of packaging suggestion; PR [#75](https://github.com/IdeFrontend/profiling-report/pull/75).

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

---

## UI-37 (was: Q10)

- **Resolved:** 2026-09-10
- **Question:** Source / Details / Cache tabs?
- **Decision:** Secondary tabs **源码 / 详情 / 缓存** stay in chrome but are **disabled**; only **时间线** is active. No tab surfaces or data contracts in this product phase. OP算子 remains brand / multi-op selector, not a mode tab.
- **Specs:** [FEATURE_MATRIX](../../ui/FEATURE_MATRIX.md), [UX_SPEC](../../ui/UX_SPEC.md), [UI_OVERVIEW](../../ui/UI_OVERVIEW.md), [VIEW_DATA_REQUIREMENTS](../../formats/VIEW_DATA_REQUIREMENTS.md), [ReportToolbar.spec.md](../../../src/ui/ReportToolbar/ReportToolbar.spec.md)
- **Source:** Product answer in chat (2026-09-10).

---

## UI-40 (was: Q14)

- **Resolved:** 2026-09-10
- **Question:** Time units UX?
- **Decision:** Display mode is **时间（自动）** vs **CPU 时钟周期** (gated on valid OpBasicInfo freq). Wall time is **two-tier auto**: viewport/overview chrome (axis, cursor) from visible span / axis density; tooltip, detail Start·End·Duration, and measure/gap Δt use per-value magnitude units. **No** manual s/ms/µs/ns dropdown. Cycle conversion details owned by [UI-45](UI.md).
- **Specs:** [format-time.spec.md](../../../specs/core/format-time.spec.md), [FEATURE_MATRIX](../../ui/FEATURE_MATRIX.md), [INTERACTIONS](../../ui/INTERACTIONS.md), [COMPONENTS](../../architecture/COMPONENTS.md), [VIEW_DATA_REQUIREMENTS](../../formats/VIEW_DATA_REQUIREMENTS.md), [ReportToolbar.spec.md](../../../src/ui/ReportToolbar/ReportToolbar.spec.md), [ProfilingReport.spec.md](../../../src/ui/ProfilingReport/ProfilingReport.spec.md)
- **Source:** Product confirmation of shipping UX formerly interim UI-40a (2026-09-10).

---

## UI-45 (was: Q23 / HQ 38)

- **Resolved:** 2026-09-10
- **Question:** Timeline CPU clocks — true vs derived? Scope for axis / cursor / measure?
- **Decision:** Use **derived** cycles: `cycles = ns × freqMHz / 1000` with `freqMHz` = OpBasicInfo `Current Freq` when valid, else `Rated Freq` (MHz; not HardwareInfo `ai_core_frequency_MHZ`). Integer, space-grouped, no suffix, no leading zeroes; cycle domain is trace-relative (`ns − model.minTime`). Scope = **event tooltip + event detail strip only**; axis ticks, cursor, and measure Δt stay in wall time. Not per-event `*_total_cycles`; display conversion only. Hide clocks option when freq missing/invalid; fall back to time if freq disappears while in cycles.
- **Specs:** [format-time.spec.md](../../../specs/core/format-time.spec.md), [METRICS_AND_TRACE](../../formats/METRICS_AND_TRACE.md), [INPUT_FORMATS](../../formats/INPUT_FORMATS.md), [VIEW_DATA_REQUIREMENTS](../../formats/VIEW_DATA_REQUIREMENTS.md), [FEATURE_MATRIX](../../ui/FEATURE_MATRIX.md), [INTERACTIONS](../../ui/INTERACTIONS.md)
- **Source:** Product confirmation of interim choice A (2026-09-10).
