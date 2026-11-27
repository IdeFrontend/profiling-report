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

_Behavior is defined by the PR #273 requirements, not the design frames: checkboxes apply immediately; 基线对比 / **Compare baselines** starts the comparison and closes the picker; while comparing, the same slot is 取消对比 / **Cancel comparison**. There is no Add baseline step and no current-report row._

## Purpose

Let the user pick comparison baselines (对比基线): the timeline toolbar's add-baseline control opens the checkbox popover listing the app's reports (MSTT: the live Performance results tree; web: the demo list). The checked set **is** the host list — every toggle and 添加报告文件 / **Add report file** applies immediately, and closing the popover keeps it. Checking alone does not start a comparison: the aside stays plain. 基线对比 / **Compare baselines** starts the comparison (one default row on the first checked baseline) and closes the picker; while comparing, the same right-hand slot is 取消对比 / **Cancel comparison**, which clears the comparison rows and keeps the checked set. Compare is disabled while nothing is checked. The aside's comparison bar shows the **comparison rows** only while rows exist. The host persists the checked list and rows.

**Rows (1130 添加基线和选择基线操作说明).** The rows sit directly under the panel title, **above** the 进程 / 算子类型 meta line. Every row carries two dropdowns — the report (from the checked set) and the operator (the pack's operators). The comparison set holds **one row per operator of every checked baseline** — never more: the `+` disables once the sum of the checked baselines' operator counts is used, so the same report can repeat with different operators. The **first row ends with `+`** (add a row: the next unused report + operator pair, walking a report's operators before moving to the next checked baseline) and every row after it with `−` (remove); the **first row is the primary and cannot be removed** (第一条不删除). An unset operator reads 请选择 / Select. The first row's operator defaults to the pack operator **matching the open report's opName** (the first otherwise); switching a row's report resets its operator to that default. Row titles derive from the entry (filename + timestamp replace a generated boilerplate id); the popup title is 基线 / **Baseline**.

## Comparison rendering

Comparison rendering is driven by the host-adapted packs (`baselineReports`, one per checked baseline id). The **first row is the primary**: it paints every inline delta exactly as a single-baseline comparison did. The other rows are compared too — **with each baseline separately, never an average** — but only surface in the per-value **hover popups**: hovering an inline delta (summary card, PIPE row, details field, topology badge) lists the current value and every row's own value + delta. With no row — or none of its packs adapted — every surface renders exactly as the plain report: no delta chrome and no extra nodes. A row whose pack is still adapting paints no comparison (never another baseline's values). The multi-baseline popup opens on hovering/focusing the **delta chip** (the card value keeps its own exact-value tooltip): a `#262626` box (12px radius, 1px `rgba(255,255,255,0.05)` border, `0 0 16px rgba(0,0,0,0.2)` shadow) listing the CURRENT value first and then every row's own value and **unsigned** delta (tone badge + magnitude; the badge carries the direction, so a fall never prints a minus). Values right-align in one fixed column and delta chips start at one left edge in the next, so nothing shifts row to row. Duration rows share the current card's unit.

- **Summary cards / PIPE / compute 详情** — the existing comparison surfaces: card deltas, the PIPE per-row baseline deltas (one bar in comparison mode: the value line carries arrow badge, gap and the percentage-point magnitude), and the compute details' per-field delta badges. Every comparison row's delta badge opens the **baseline hover popup** (current value first, then every row: `基线N  <value>  <arrow> <delta>`), including with a single baseline row; the popup lays them out in aligned columns — values right-aligned, delta badges left-aligned, the current value flush in the top-right corner.
- **内存负载分析 (memory load analysis)** — with a baseline selected, the diagram keeps the **master chrome and label layout** (the `memory-topology.svg` SVG, the six in-box plate values and the L2 peak percentage never move); every comparable percentage (the in-box unit utilities — AIC `Scalar`, AIV `Scalar`, `Vec`, `Cube`, `SIMT` and the AIV row's own Scalar unit box — and the L2 peak) gains **only an arrow badge** — a **white** circle with a full up/down arrow (shaft + head; red = increase, green = decrease), **horizontally centred under the value**. The circle shrinks inside a shallow unit frame so it never crosses the box outline, and it prints **no numbers**: hovering (or focusing) it opens the shared multi-baseline popup with the current percentage and every comparison row's own value and unsigned percentage-point delta. The delta is `baseline − current`; equal or missing values paint no badge. The **arrows' GB/s values are never badged** — comparison covers utilization percentages only. Badges repaint in place when the Operator or the baseline changes; a report without a baseline has no badge nodes at all. The stacked diagram and the topology 全屏 overlay use the same comparison, so 全屏 shows the badges too.
- **内存 详情 (memory details)** — every memory `SummaryCategoryList` (the stacked section and the 详情 overlay) paints the same per-field delta badges the compute details overlay has, right of each field value; the list pairs the baseline's categories by category id and field key over the same memory-category ids (`MemoryL0`, `L2Cache`, `Memory`, `MemoryUB`). A picked block shows CSV field lists (values, no badges), exactly like compute; a baseline that carries no memory categories paints no memory badges.

## View-model

| Field | Role | Required? |
|-------|------|-----------|
| `baselines: Baseline[]` | The checked baseline list: `{ id, name, path, operators?, pickedAt? }`; every toggle applies immediately | Required to show the list |
| `baselineRows: BaselineRow[]` | The comparison rows: `{ id, baselineId, operatorId }`; `operatorId` `''` = auto (opName match, else first); row 0 is the primary. Non-empty = comparison active (the picker shows 取消对比 / **Cancel comparison**) | Required to compare |
| `baselineReports: BaselineReports` | Host-adapted packs keyed by baseline id: `{ [baselineId]: { baselineId, report } }` | Required to paint a row |
| `baselines[i].pickedAt?: number` | Pick timestamp (mtime) — the derived title's stamp | Optional |
| `pickBaselineFile` hook | Host file dialog for 添加报告文件 / **Add report file** | **Required to show the control** |
| `recentBaselines: Baseline[]` | The host's report list — one checkbox row each | Optional — absent, the view shows the empty copy plus the footer |

## Hide rule

Trigger and popover are absent when `pickBaselineFile` is not provided (the library never reads the filesystem itself — same contract as `resolveSourceFile`). The checkbox view renders whenever the popover opens; the checked state comes from the host-owned `baselines` list.

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
| compute | — | No adapter — host supplies `baselines` / `baselineRows` / `baselineReports` props |
| emulate | — | No adapter — same props |

## Related

- UX scenario: none yet (new surface)
- FEATURE_MATRIX: [FEATURE_MATRIX](../ui/FEATURE_MATRIX.md) — Toolbar row
- Co-located spec: `src/ui/ReportToolbar/BaselinePicker/BaselinePicker.spec.md`
- Root contract: `src/ui/ProfilingReport/ProfilingReport.spec.md` (PR-ROOT-045…054)
- Host contract: [MSTT_INTEGRATION](../architecture/MSTT_INTEGRATION.md) — persistence via props/state
- **Every host that mounts `ProfilingReport` must pass the baseline contract** (`baselines` / `baselineRows` / `baselineReports` / `pickBaselineFile` / `recentBaselines` + apply the `update:baselines` / `update:baselineRows` emits) or the control stays hidden: the playground (`playground/App.vue` — the **baselines** link opens the picker; the checked set always starts EMPTY) and the **exported HTML shell** (`report-shell/App.vue` — hidden file input) both bundle it through the shared `src/host/baselinesHost.ts`, so the offline artifact keeps the control. The exported shell passes **no** `recentBaselines`: a single-file artifact has no `/data` fixtures, so demo recent rows could never adapt — its picker offers 添加报告文件 / **Add report file** only (empty recent list); the demo recent list belongs to the playground host, where those fixture paths resolve. The checked set always starts **empty**. The aside shows the comparison bar under its meta line **only while comparison rows exist** — selecting baselines alone leaves it hidden, 基线对比 / **Compare baselines** creates 基线1 and closes the picker, and 取消对比 / **Cancel comparison** clears the rows ([UI-63 resolved](../context/decisions/UI.md)). The root prunes rows whose baseline leaves the checked list; Compare defaults one row to the first checked baseline. Pressing the bar closes the baselines popover. The shared host glue adapts every checked baseline once and caches the pack by id; re-picking a file re-adapts **that path's** pack only — every other compared baseline keeps its cached pack on screen, so Add report file never blanks the deltas already painted (the pseudo-path carries size + mtime, so a changed file is a different path); there is no persistence in the library or the bundled hosts: the checked set and rows live in session state until the page reloads (like the other playground demo values); a real host (MSTT) persists through its own storage via the same emits. The checkbox view's demo list (`DEMO_RECENT_BASELINES` in the shared host glue) carries the real opprof runId format the plugin lists (`OPPROF_<YYYYMMDDHHMMSS>_<16 uppercase letters>`); its rows title through `baselineDisplayTitle` — the report filename + the run timestamp (e.g. `out.rep 2026-11-08 14:25`) instead of the generated id — with the playground fixture URLs (`/data/*.rep`) as paths — the glue fetches those bytes itself, so selecting a demo baseline adapts and paints the card deltas (resolved through the row's Operator select) like a browsed one. The demo packs are reseeded per baseline and operator — every summary card, PIPE row, details field (compute **and** memory, covering the demo report's whole key set even when the baseline fixture carries its own categories), the six in-box plate percentages and the L2 peak, plus **per-block** `PipeUtilization` / `L2Cache` rows for every block the open report can list — so every comparison element paints a non-zero delta instead of depending on which blocks or fields the baseline fixture happened to share. Seeded ranges avoid landing on the open report's own value at the two-decimal display step (a suppressed badge) and vary baseline-to-baseline; the per-block hash puts the operator index first, so the Operator select repaints every block-scoped badge too.
- Behavior: PR #273 requirements (this doc + [BaselinePicker.spec.md](../../src/ui/ReportToolbar/BaselinePicker/BaselinePicker.spec.md)).
