# Interim UI rules

Provisional engineering defaults for **UI** questions — **not Product-final**. Each rule derives a sub-letter id from its question id.

Meta-rules, MVP scope checklist, and related specs: [README.md](README.md).

### UI-46a — Card gutter 时钟周期 label units

**Status:** `interim`
**Question:** [UI-46](../../questions/UI.md)
**Interim:** Labels always suffix **`µs`** (same glyph as `formatTime`) so values are not read as `%` or bare ratios. Formatting: integer when \(\lvert raw\rvert\ge 0.5\); else two decimals / `toPrecision(2)` when tiny (`PR-GMET-008`).
**Implement / test as:** `formatClockCycleLabel`, LaneGutter thick/tip labels — [gutter-metrics.spec.md](../../../../specs/core/gutter-metrics.spec.md) (`PR-GMET-008`)
**Superseded when:** Product confirms unit glyph, locale wording, or cycle-count display ([UI-46](../../questions/UI.md))
