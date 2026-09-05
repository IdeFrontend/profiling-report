# Interim UI rules

Provisional engineering defaults for **UI** questions — **not Product-final**. Each rule derives a sub-letter id from its question id.

Meta-rules, MVP scope checklist, and related specs: [README.md](README.md).

### UI-40a — Time units

**Status:** `interim`
**Question:** [UI-40](../../questions/UI.md)
**Interim:** **Two-tier auto:** viewport/overview **chrome** (axis, cursor) from visible span / axis density; tooltip, detail Start·End·Duration, and measure/gap **Δt** use **per-value** magnitude units (PyPTO-like). **No** manual unit dropdown. **No** clock-cycle mode yet.
**Implement / test as:** Formatter + resolvers; `formatTimeAuto` for absolute times
**Superseded when:** Product specifies cycle mode + frequency source

### UI-41a — Gesture parity

**Status:** `interim`
**Question:** [UI-41](../../questions/UI.md)
**Interim:** Follow [PACKAGING_SUGGESTIONS](../../PACKAGING_SUGGESTIONS.md) as if accepted for scaffold: wheel/slider/drag MVP; W/S/A/D P2.
**Implement / test as:** wheel/slider/drag MVP; W/S/A/D P2
**Superseded when:** Product confirm/change UI-41

### UI-46a — Card gutter 时钟周期 label units

**Status:** `interim`
**Question:** [UI-46](../../questions/UI.md)
**Interim:** Labels always suffix **`µs`** (same glyph as `formatTime`) so values are not read as `%` or bare ratios. Formatting: integer when \(\lvert raw\rvert\ge 0.5\); else two decimals / `toPrecision(2)` when tiny (`PR-GMET-008`).
**Implement / test as:** `formatClockCycleLabel`, LaneGutter thick/tip labels — [gutter-metrics.spec.md](../../../../specs/core/gutter-metrics.spec.md) (`PR-GMET-008`)
**Superseded when:** Product confirms unit glyph, locale wording, or cycle-count display ([UI-46](../../questions/UI.md))
