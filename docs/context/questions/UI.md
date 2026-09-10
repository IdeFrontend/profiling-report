# UI questions

Open **UI** questions (presentation / UX). Status enum, prefix taxonomy, and migration map: [README.md](README.md).

### UI-46 — Card gutter 时钟周期 label units (was: HQ 40)

**Status:** `interim`

**Question:** Should gutter **时钟周期** labels show a time unit (e.g. **`µs`**), bare numbers, or cycle counts?

**Answer so far (interim):** Labels always suffix **`µs`**. Interim: [`UI-46a`](../decisions/interim/UI.md). Formula: [`DATA-38`](DATA.md) / [`DATA-38a`](../decisions/interim/DATA.md). Spec: [gutter-metrics.spec.md](../../../specs/core/gutter-metrics.spec.md) (`PR-GMET-008`).

**Specs when answered:** [METRICS_AND_TRACE](../../formats/METRICS_AND_TRACE.md), [FEATURE_MATRIX](../../ui/FEATURE_MATRIX.md), [gutter-metrics.spec.md](../../../specs/core/gutter-metrics.spec.md).
