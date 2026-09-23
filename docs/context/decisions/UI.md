# UI decisions

Product-final answers to **UI** questions (presentation / UX) that have left the open list. Each entry keeps the **same bare id** as its question in [questions/](../questions/), plus a `Was` reference to the pre-merge id.

Normative truth lives in the owning **specs** (linked per entry); this log is the traceability record, not the source of truth.

Format and statuses: [README.md](README.md).

---

## UI-30 (was: HQ 30)

- **Resolved:** 2026-08-31
- **Question:** Must every report include `HardwareInfo.jsonl`?
- **Decision:** **Yes** — every report is expected to include `HardwareInfo.jsonl`. If absent, **更多** still opens and shows **缺少 hardware info**.
- **Specs:** [report-summary](../../views/report-summary.md), [VIEW_DATA_MAPPING § Hardware details](../../ui/VIEW_DATA_MAPPING.md#stub-hardware-details)
- **Source:** Product answer doc (2026-08-31); implemented in `StatsAside.vue`.

---

## UI-31 (was: HQ 31)

- **Resolved:** 2026-08-31
- **Question:** If `HardwareInfo.jsonl` is missing, what happens to **更多** / 硬件信息详情?
- **Decision:** Do **not** hide **更多**. Open overlay and show **缺少 hardware info**.
- **Specs:** [report-summary](../../views/report-summary.md), [VIEW_DATA_MAPPING § Hardware details](../../ui/VIEW_DATA_MAPPING.md#stub-hardware-details)
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
- **Specs:** [report-summary](../../views/report-summary.md#data-33h), [decisions/interim/](interim/) `DATA-33h`
- **Source:** Product answer doc (2026-08-31); implemented in `StatsAside.vue`.

---

## UI-34 (was: HQ 34)

- **Resolved:** 2026-08-31
- **Question:** If measured I/O is small (e.g. `15.8 GB/s`), show **GB/s** or **TB/s**?
- **Decision:** Always **GB/s** (not TB/s).
- **Specs:** [report-summary](../../views/report-summary.md#data-8-bandwidth), [decisions/DATA.md](DATA.md) `DATA-8`
- **Source:** Product answer doc (2026-08-31); implemented via `formatGBs()` in `StatsAside.vue`.

---

## UI-35 (was: HQ 35)

- **Resolved:** 2026-08-31
- **Question:** Right-click on the memory diagram — extra details? Which fields?
- **Decision:** **Yes.** Show full CSV tables: **Memory**, **L2Cache**, **MemoryUB**, **MemoryL0** (block-scoped).
- **Specs:** [memory-topology](../../views/memory-topology.md#memory-load-details), [MemoryTopologyPanel](../../../src/ui/StatsAside/MemoryTopologyPanel/MemoryTopologyPanel.spec.md) (PR-MEMTOP-008), [StatsAside](../../../src/ui/StatsAside/StatsAside.spec.md) (PR-STATS-017b)
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

- **Resolved:** 2026-07-31 (updated 2026-09-10; CSV-path caveat 2026-09-14)
- **Question:** Memory topology rendering?
- **Decision:** Static SVG + data-driven edge labels. The chrome's `MTE1`/`MTE2`/`MTE3` blocks get **no** diagram value plate — the export gives them none — so the adapter models them as nodes and their utilizations stay reachable through `PipeUtilization.csv` in the memory 详情 **CSV field list** (CSV-only reports without memory summary categories — [PR-STATS-035](../../../src/ui/StatsAside/StatsAside.spec.md)). Product `.npu-rep` reports with memory `summaryCategories` list those categories instead; their MTE ratios stay under **计算 详情** → `PipeUtilization`. Values too wide for their slot are scaled down rather than overlapping the chrome.
- **Specs:** [VIEW_DATA_REQUIREMENTS](../../formats/VIEW_DATA_REQUIREMENTS.md), [MemoryTopologyPanel](../../../src/ui/StatsAside/MemoryTopologyPanel/MemoryTopologyPanel.spec.md), [StatsAside](../../../src/ui/StatsAside/StatsAside.spec.md), [view-models](../../../specs/core/view-models.spec.md)
- **Source:** Design sketch `v930/report-stats-scrolled` (no MTE value plates); Product answer 2026-09-10 — keep the diagram exactly as designed and surface the ratios in 内存 详情, scoped to the CSV field-list path already codified in PR-STATS-035 (summary-category reports keep MTE under 计算 详情).

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

- **Resolved:** 2026-09-11
- **Was:** filter + highlight (2026-08-28, PR [#52](https://github.com/IdeFrontend/profiling-report/pull/52)) — superseded.
- **Question:** CSV 详情 search — filter only, or filter + highlight?
- **Decision:** **Filter only**: search hides rows whose headers do not contain the query and leaves the matching labels unstyled — no substring chip. Same rule on the compute and memory overlays.
- **Specs:** [CsvFieldListPanel.spec.md](../../../src/ui/StatsAside/CsvFieldListPanel/CsvFieldListPanel.spec.md) (`PR-CSV-003`), [UX_SPEC](../../ui/UX_SPEC.md), [FEATURE_MATRIX](../../ui/FEATURE_MATRIX.md), [UI_OVERVIEW](../../ui/UI_OVERVIEW.md)
- **Source:** Product answer to Q37 in npu-computing `npu-tools` `npu-compute/Questions/NPU-Compute.md` (2026-09-11): "Hide non-matching rows and filter only".

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
- **Specs:** [format-time.spec.md](../../../specs/core/format-time.spec.md), [METRICS_AND_TRACE](../../formats/compute/METRICS_AND_TRACE.md), [INPUT_FORMATS](../../formats/README.md), [VIEW_DATA_REQUIREMENTS](../../formats/VIEW_DATA_REQUIREMENTS.md), [FEATURE_MATRIX](../../ui/FEATURE_MATRIX.md), [INTERACTIONS](../../ui/INTERACTIONS.md)
- **Source:** Product confirmation of interim choice A (2026-09-10).

---

## UI-46 (was: HQ 40)

- **Resolved:** 2026-09-14
- **Question:** Should gutter **时钟周期** labels show a time unit (e.g. **`µs`**), bare numbers, or cycle counts?
- **Decision:** **Clock Cycles** gutter labels are **bare absolute cycle counts** — integer, space-grouped when ≥1000, **no** `µs` / ms / unit-word suffix. **Utilization** labels stay `` `${barWidth}%` ``. Quantity/formula owned by [DATA-38](./DATA.md).
- **Specs:** [gutter-metrics.spec.md](../../../specs/core/gutter-metrics.spec.md) (`PR-GMET-008`), [METRICS_AND_TRACE](../../formats/compute/METRICS_AND_TRACE.md), [FEATURE_MATRIX](../../ui/FEATURE_MATRIX.md), [LaneGutter.spec.md](../../../src/ui/TimelineView/SwimlaneView/LaneGutter/LaneGutter.spec.md)
- **Source:** Product confirmation with [DATA-38](./DATA.md) (2026-09-14): bare absolute cycle counts, no `µs` / unit suffix. Supersedes interim [`UI-46a`](interim/UI.md).

---

## UI-49

- **Resolved:** 2026-09-15
- **Question:** [DATA-20](DATA.md) settled the **L2** plate (hit rate, not a peak-relative percent). The sketch also draws nine in-box `%` badges — AIV0/AIV1 `Scalar`, AIV0/AIV1 `Vec`, AIC `Scalar`, `Cube`, AIV0/AIV1 `SIMT VF`, AIV0/AIV1 `SIMD VF`, `FixP` — while the export gives a plate to none of them. Should any other unit show a **Peak(%)** badge, and if so what is its 100% reference?
- **Decision:** The nine badges are **unit utilizations, not peak-relative percents** — no unit gains a peak badge, and the L2 plate keeps its DATA-20 hit-rate meaning. Paint the **three units that have a producer field**, each `{ratio × 100}%` at the sketch's two decimals (the ratio is a fraction of the unit's **own** busy time, DATA-28; the 计算负载分析 pipe rows print the same ratio rounded): AIV0 **and** AIV1 `Scalar` ← `aiv_scalar_ratio`, AIV0 **and** AIV1 `Vec` ← `aiv_vec_ratio`, AIC `Cube` ← `aic_cube_ratio` (all `Summary.jsonl` → `PipeUtilization`). The badges go **in the unit's own box** at the sketch's positions — the export needs no new plate rects. The producer's six `NA` badge rows (AIC `Scalar`, AIV0/AIV1 `SIMT VF`, AIV0/AIV1 `SIMD VF`, `FixP`) cover only **four** positions and stay **blank** — the `SIMD VF` rows name the same in-box position as the painted `Vec` rows (`6'`/`7'`).
- **Specs:** [MemoryTopologyPanel](../../../src/ui/StatsAside/MemoryTopologyPanel/MemoryTopologyPanel.spec.md) (PR-MEMTOP-016), [view-models](../../../specs/core/view-models.spec.md) (PR-VM-023), [memory-topology](../../views/memory-topology.md#edge-field-source), [StatsAside](../../../src/ui/StatsAside/StatsAside.spec.md), [FEATURE_MATRIX](../../ui/FEATURE_MATRIX.md)
- **Source:** Producer `npu-tools` → `npu-compute/Questions/DATA questions/DATA questions.md` DATA-39 "Memory" table (2026-09-15), which maps the three badges and marks the other six **rows** `NA` (four in-box positions, since its `SIMD VF` rows name the painted `Vec` position); Product approval in chat (2026-09-15) to paint the units with a field and leave the four field-less positions blank. Rendered evidence: [`memory-topology-in-box-badges.png`](../visual/memory-topology-in-box-badges.png) — the three badges as the shipped panel paints them in the official chrome.
