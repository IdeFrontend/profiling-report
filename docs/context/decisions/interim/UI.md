# Interim UI rules

Provisional engineering defaults for **UI** questions — **not Product-final**. Each rule derives a sub-letter id from its question id.

Meta-rules, MVP scope checklist, and related specs: [README.md](README.md).

### UI-40a — Time units

**Status:** `interim` — **SUPERSEDED** 2026-09-10 by [UI-40](../UI.md) / [UI-45](../UI.md)
**Question:** [UI-40](../UI.md) / [UI-45](../UI.md) *(resolved — removed from open list)*
**Interim:** ~~**Time (auto)** vs **CPU clocks**; two-tier auto wall time; derived `cycles = ns × OpBasicInfo freq / 1000` (tooltip + detail only).~~ Product-final: [UI-40](../UI.md) (display mode / two-tier auto) and [UI-45](../UI.md) (derived cycles from OpBasicInfo `Current Freq` / `Rated Freq`).
**Implement / test as:** Formatter + toolbar mode + host `timeDisplayMode` prop — see [format-time.spec.md](../../../../specs/core/format-time.spec.md) (`PR-TIME-*`).
**Superseded when:** — already superseded by UI-40 / UI-45 (2026-09-10)

### UI-46a — Card gutter 时钟周期 label units

**Status:** `interim` — **SUPERSEDED** 2026-09-14 by [UI-46](../UI.md) / [DATA-38](../DATA.md)
**Question:** [UI-46](../../questions/UI.md) *(resolved — removed from open list)*
**Interim:** ~~Bare absolute cycle counts (no `µs`).~~ Product-final: [UI-46](../UI.md) (with [DATA-38](../DATA.md)).
**Implement / test as:** `formatClockCycleLabel`, LaneGutter thick/tip labels — [gutter-metrics.spec.md](../../../../specs/core/gutter-metrics.spec.md) (`PR-GMET-008`)
**Superseded when:** — already superseded by UI-46 / DATA-38 (2026-09-14)

<a id="ui-53a"></a>

### UI-53a — Emulate Source keeps shared SASS chrome label

**Status:** `interim` — **SUPERSEDED** 2026-11-26 by [UI-56](../UI.md)
**Question:** [DATA-53](../DATA.md) (resolved; presentation default) / [UI-56](../UI.md)
**Interim:** Keep the dual-pane right-side label / language id **SASS** for emulate (shared with compute). Do not invent a separate “Assembly” / ISA chrome name in this slice. Metric columns come from `model.assembly.metricsColumns` (compute stall set vs emulate MVP) — Address / Assembly stay leading text columns ([PR-SOURCE-013](../../../../src/ui/SourceView/SourceView.spec.md)).
**Implement / test as:** `SourceView` / `AsmTablePane`; assembly `language: 'sass'`; no `profile === 'emulate'` branching in the view
**Superseded when:** — already superseded by UI-56 (2026-11-26)
