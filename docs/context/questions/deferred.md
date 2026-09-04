# Deferred questions (backlog)

Parked by Product — **out of this iteration**, not interim guesses and not resolved.

Each record keeps its domain id (`DATA-` / `UI-` / `PROC-` / `PKG-`) and is marked with the `deferred` status. A single flat file is the home for a one-item backlog; promote to `deferred/{PREFIX}.md` only if it grows.

Status enum, prefix taxonomy, and migration map: [README.md](README.md).

---

### UI-44 — pin grouping / folder nodes (was: D-PIN-FOLDER)

**Status:** `deferred`
**Question:** Pin grouping / folder nodes?
**Answer so far (deferred):** Do **not** ship folder/Card pin this iteration; leaf-only pin stays (`#51`).
**Parked work:** Branch `feat/pin-grouping-nodes` (PR [#69](https://github.com/IdeFrontend/profiling-report/pull/69) closed unmerged; branch kept).
**Revisit when:** Product schedules folder pin.
