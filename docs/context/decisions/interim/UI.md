# Interim UI rules

Provisional engineering defaults for **UI** questions — **not Product-final**. Each rule derives a sub-letter id from its question id.

Meta-rules, MVP scope checklist, and related specs: [README.md](README.md).

### UI-40a — Time units

**Status:** `interim`
**Question:** [UI-40](../../questions/UI.md) (cycle source open: [UI-45](../../questions/UI.md))
**Interim:** **Time (auto)** vs **CPU clocks**. Time mode is **two-tier auto**: viewport/overview **chrome** (axis, cursor) from visible span / axis density; tooltip, detail Start·End·Duration, and measure/gap **Δt** use **per-value** magnitude units (PyPTO-like). **No** manual unit dropdown.

**Clocks.** `cycles = ns × freqMHz / 1000` with `freqMHz` = `SummaryMetrics.currentFreq` when valid, else `ratedFreq` (both from `OpBasicInfo.csv` `Current Freq` / `Rated Freq`; a present-but-zero/invalid Current Freq defers to Rated rather than hiding the option). Values are **MHz** (AI Core clock; matches aside **aic频率**). Conversion uses an exact BigInt path (`round(ns) × round(freqMHz) / 1000`, half-up) so grouped digits stay exact past `Number.MAX_SAFE_INTEGER` on long traces.

**Label format.** Cycles render **as a number only** (no `cyc` / `cycles` suffix), rounded to an integer, space-grouped in 3-digit groups with **no leading zeroes** — e.g. `10 325`, `5 000`, `325`, `0`. **Cycle domain is trace-relative** (`ns − model.minTime`, matching wall-time display).

**Scope.** Cycles apply **only** to the event tooltip and event detail strip — axis ticks, the cursor, and measure Δt stay in wall time. Not per-event `*_total_cycles`; display conversion only.

**Gating.** Hide the clocks option when freq is missing/invalid; fall back to time if freq disappears while in cycles. Do **not** use `HardwareInfo.jsonl` `ai_core_frequency_MHZ` (sample values can disagree with OpBasicInfo).

**Why Current Freq.** Prefer current over rated when they differ (DVFS / measured operating clock). On [`data/out.rep`](../../../data/out.rep), `PipeUtilization` `aiv_total_cycles / aiv_time(us)` equals OpBasicInfo `Current Freq` (1650) per block — display conversion matches measured block cycles for that pack.

**Caveats.** Interim choice **A** under [UI-45](../../questions/UI.md) (true vs derived). Assumes swimlane timestamps share the AIC clock domain as OpBasicInfo freq.
**Implement / test as:** Formatter + toolbar mode + host `timeDisplayMode` prop; `formatTimeAuto` for absolute times
**Superseded when:** Product answers [UI-45](../../questions/UI.md) (true vs derived cycles) and/or refines freq/labels
