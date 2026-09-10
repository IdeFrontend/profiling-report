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

**Status:** `interim`
**Question:** [UI-46](../../questions/UI.md)
**Interim:** Labels always suffix **`µs`** (same glyph as `formatTime`) so values are not read as `%` or bare ratios. Formatting: integer when \(\lvert raw\rvert\ge 0.5\); else two decimals / `toPrecision(2)` when tiny (`PR-GMET-008`).
**Implement / test as:** `formatClockCycleLabel`, LaneGutter thick/tip labels — [gutter-metrics.spec.md](../../../../specs/core/gutter-metrics.spec.md) (`PR-GMET-008`)
**Superseded when:** Product confirms unit glyph, locale wording, or cycle-count display ([UI-46](../../questions/UI.md))
