# UI questions

Open **UI** questions (presentation / UX). Status enum, prefix taxonomy, and migration map: [README.md](README.md).

### UI-36 — KB vs GB/s units on the memory diagram

<img src="../visual/questions/ui-36.png" alt="UI-36 GB/s on GM↔L2 arrows" width="900" height="900">

**Status:** `open`

**Question:** Some labels are **KB**, some **GB/s**. Keep both, or convert to one unit? (KB would be L0C datas.)

### UI-37 — Source / Details / Cache tabs (was: Q10)

**Status:** `open`

**Question:** Source / Details / Cache tabs?

**Specs:** [FEATURE_MATRIX](../../ui/FEATURE_MATRIX.md), [UX_SPEC](../../ui/UX_SPEC.md), [MSTT_INTEGRATION](../../architecture/MSTT_INTEGRATION.md), [FORMATS_COMPARISON](../../formats/FORMATS_COMPARISON.md)

### UI-40 — time units UX (was: Q14)

**Status:** `partial` + `interim`

**Question:** Time units UX?

**Answer so far:** Two-tier auto **and** Time (auto) vs CPU clocks — [`UI-40a`](../decisions/interim/UI.md). Cycle *source* (true vs derived) → [UI-45](UI.md).

### UI-41 — gesture parity (was: Q19)

**Status:** `interim`

**Question:** Gesture parity?

**Interim:** Wheel/slider/drag MVP; W/S/A/D P2 — [`UI-41a`](../decisions/interim/UI.md).

### UI-45 — Timeline CPU clocks — true vs derived (was: Q23 / HQ 38)

<img src="../visual/questions/ui-45.png" alt="UI-45 task display unit Time vs CPU clocks" width="475" height="260">

**Status:** `open` + `interim`

**Question:** Must timeline “CPU clocks” (event tooltip / detail strip) use **true** cycle-domain timestamps/counters from the producer, or is **derived** `ns × OpBasicInfo freq` acceptable? Should cycles also apply to the axis, cursor, or measure Δt?

**Freq source (interim A).** Derived mode reads frequency from the `.rep` embed [`OpBasicInfo.csv`](../../formats/INPUT_FORMATS.md#31-opbasicinfocsv) columns **`Current Freq`** / **`Rated Freq`** (MHz) — see also [METRICS_AND_TRACE — OpBasicInfo.csv](../../formats/METRICS_AND_TRACE.md#opbasicinfocsv) and [VIEW_DATA_REQUIREMENTS](../../formats/VIEW_DATA_REQUIREMENTS.md) (Current / rated frequency). The adapter maps them to `SummaryMetrics.currentFreq` / `ratedFreq`; display uses `currentFreq` when valid, else `ratedFreq` ([`UI-40a`](../decisions/interim/UI.md)). Not from [`HardwareInfo.jsonl`](../../formats/INPUT_FORMATS.md#32-hardwareinfojsonl) `ai_core_frequency_MHZ`.

- **A (interim / shipping):** derived via [`UI-40a`](../decisions/interim/UI.md) — `cycles = ns × freqMHz / 1000` using the OpBasicInfo columns above, integer, space-grouped, no suffix, no leading zeroes; scope = tooltip + detail only.
- **B:** drop the derived cycles mode; show real `*_total_cycles` only where present (e.g. block counters in [`PipeUtilization.csv`](../../formats/METRICS_AND_TRACE.md#pipeutilizationcsv)).
- **C:** producer adds per-event cycle timestamps (`start_cycles`/`end_cycles` or cycle-tick `ts`/`dur`).

**Interim:** time measurement / range Δt (and axis + cursor) always stay in wall time (`ms`/`µs`/`ns`), never cycles.

**Why open:** embeds have block `aic`/`aiv_total_cycles` only — no event cycle positions for axis/gaps/measure.

**Specs when answered:** [METRICS_AND_TRACE](../../formats/METRICS_AND_TRACE.md), [INPUT_FORMATS](../../formats/INPUT_FORMATS.md), [VIEW_DATA_REQUIREMENTS](../../formats/VIEW_DATA_REQUIREMENTS.md), FEATURE_MATRIX, format-time / INTERACTIONS.

### UI-46 — Card gutter 时钟周期 label units (was: HQ 40)

**Status:** `interim`

**Question:** Should gutter **时钟周期** labels show a time unit (e.g. **`µs`**), bare numbers, or cycle counts?

**Answer so far (interim):** Labels always suffix **`µs`**. Interim: [`UI-46a`](../decisions/interim/UI.md). Formula: [`DATA-38`](DATA.md) / [`DATA-38a`](../decisions/interim/DATA.md).

**Specs when answered:** [METRICS_AND_TRACE](../../formats/METRICS_AND_TRACE.md), [FEATURE_MATRIX](../../ui/FEATURE_MATRIX.md) (label formatting ACs arrive with PR #45).
