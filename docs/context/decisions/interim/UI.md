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
