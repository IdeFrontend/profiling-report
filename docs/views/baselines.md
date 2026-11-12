# Baselines (对比基线)

| | |
|--|--|
| **Id** | `baselines` |
| **Panel / component** | `BaselinePicker` → `src/ui/ReportToolbar/BaselinePicker/` |
| **Capability** | _(none — host-hook driven)_ |
| **Phase** | M |
| **Unification** | `out-of-scope` (host-owned data; not a report embed surface) |
| **Sept 30 (emulate)** | `in` (independent of report profile) |

## Sketches

_Sketch gap: no design frame covers this surface yet. Chrome follows the toolbar popover family (显示控制 panel tokens, action-icon trigger)._

## Purpose

Let the user pick comparison baselines (对比基线): the timeline toolbar's add-baseline control opens a single checkbox view listing the app's reports (MSTT: the live Performance results tree; web: the demo list). The checked set IS the saved baseline list — toggles apply immediately, survive closing the popover, and the host persists. The aside's Baseline / Operator dropdown row shows the checked set (Not selected when nothing is checked); the host decides what comparison rendering means.

## View-model

| Field | Role | Required? |
|-------|------|-----------|
| `baselines: Baseline[]` | The checked set: `{ id, name, path, operators? }` | Required to show the list |
| `selectedBaselineId: string \| null` | Current baseline in the aside dropdown; `null` = Not selected | Required |
| `pickBaselineFile` hook | Host file dialog for Browse | **Required to show the control** |
| `recentBaselines: Baseline[]` | The host's report list — one checkbox row each | Optional — absent, the view is empty except Browse |

## Hide rule

Trigger and popover are absent when `pickBaselineFile` is not provided (the library never reads the filesystem itself — same contract as `resolveSourceFile`). The single checkbox view renders whenever the popover opens — the checked state comes from the host-owned `baselines` list.

## Compute fill

| VM field | Source embed(s) | Join key(s) | Derivation |
|----------|-----------------|-------------|------------|
| — | — (host storage) | — | Host-owned: the library renders and selects only |

## Emulate fill

| Adapted field | Embed | Columns / notes | Status |
|---------------|-------|-----------------|--------|
| — | — (host storage) | — | same as compute — profile-independent |

## Adapter

| Profile | Entry | Notes |
|---------|-------|-------|
| compute | — | No adapter — host supplies `baselines` / `selectedBaselineId` props |
| emulate | — | No adapter — same props |

## Related

- UX scenario: none yet (new surface)
- FEATURE_MATRIX: [FEATURE_MATRIX](../ui/FEATURE_MATRIX.md) — Toolbar row
- Co-located spec: `src/ui/ReportToolbar/BaselinePicker/BaselinePicker.spec.md`
- Root contract: `src/ui/ProfilingReport/ProfilingReport.spec.md` (PR-ROOT-031…034)
- Host contract: [MSTT_INTEGRATION](../architecture/MSTT_INTEGRATION.md) — persistence via props/state
- **Every host that mounts `ProfilingReport` must pass the baseline contract** (`baselines` / `selectedBaselineId` / `pickBaselineFile` / `recentBaselines` + apply the `update:baselines` / `update:selectedBaselineId` emits) or the control stays hidden: the playground (`playground/App.vue` — the **baselines** link opens the picker; the checked set always starts EMPTY) and the **exported HTML shell** (`report-shell/App.vue` — hidden file input) both bundle it through the shared `src/host/baselinesHost.ts`, so the offline artifact keeps the control. The checked set always starts **empty** and nothing is selected. The aside shows the Baseline / Operator dropdown row **always** under its meta line (Not selected when nothing is checked — hide-vs-empty is open: [UI-63](../context/questions/UI.md); Baseline = the global selection, Operator = the baseline's `operators`, default the first). There is no persistence in the library or the bundled hosts: the checked set lives in session state until the page reloads (like the other playground demo values); a real host (MSTT) persists through its own storage via the same emits. The checkbox view's demo list (`DEMO_RECENT_BASELINES` in the shared host glue) uses the real opprof runId format the plugin lists (`OPPROF_<YYYYMMDDHHMMSS>_<16 uppercase letters>` under `<workspaceRoot>/.vscode/opprof/`).
- Open / interim questions: [UI-61](../context/questions/UI.md) — the popover chrome is not Product-confirmed
