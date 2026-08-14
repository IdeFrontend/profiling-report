# Reusable Components and Models

Normative catalog of models, adapters, renderer APIs, and Vue components for the profiling-report library. Aligns with [ARCHITECTURE.md](ARCHITECTURE.md) (shared UI + adapters) and [FEATURE_MATRIX.md](../ui/FEATURE_MATRIX.md).

**Legend:** **M** = MVP · **P2** = Phase 2+ (named now; not required to implement yet)

## Layering

```text
    adapters  →  domain models  →  Vue ui + swimlane renderer
```

| Layer | Ships | Public? |
|-------|-------|---------|
| Adapters | Format → models | Yes (`parseRep`, `loadReportSource`, …) |
| Domain | Canonical DTOs + pure helpers | Types yes; helpers via deep import |
| `SwimlaneRenderer` | Imperative timeline backend | Deep import (advanced hosts) |
| Vue UI | `ProfilingReport` and panels | Yes — `ProfilingReport` is the default host entry |

```text
ProfilingReport
├─ ReportToolbar (+ measure toggle M2)
├─ ReportLayout (main | aside)
│  ├─ TimelineView
│  │  ├─ TimeOverviewBar
│  │  ├─ TimeAxis → AxisRuler, CursorTimestamp
│  │  ├─ OverviewCharts
│  │  └─ SwimlaneView → LaneGutter, SwimlaneCanvas, DependencyLinksLayer (P2)
│  └─ StatsAside
│     ├─ StatsSummaryPanel
│     ├─ PipeOccupancyPanel (+ Cube|Vector toggle M1)
│     ├─ CsvFieldListPanel (compute + memory detail tabs M1)
│     ├─ RooflinePanel (M2)
│     ├─ MemoryTopologyPanel (M2)
│     └─ HardwareDetailsPanel (M1 interim I-Q7a)
├─ DetailPanel → DetailSummary, DetailParameter (P2), DetailRelevant (P2)
├─ EventTooltip (overlay)
├─ ContextMenu (P2 overlay)
└─ MultiSelectSummary (P2 overlay)
```

Full tree with visual-pack marks: [`src/ui/COMPONENT_TREE.md`](../../src/ui/COMPONENT_TREE.md).

## Design principles

1. **Models are format-agnostic; adapters are format-specific.** UI never switches on “`.rep` vs PyPTO”.
2. **One interactive timeline surface** (`SwimlaneRenderer`). Lane labels, tooltips, and gutters stay DOM where possible (a11y, i18n, hit-testing simplicity).
3. **Report panels consume view-models**, not CSV column names or raw Chrome Trace events.
4. **Compose small components** — avoid a god-root like PyPTO `swimGraphComplete.vue`.
5. **P2 names freeze the roadmap** without blocking MVP API freeze for core models and `ProfilingReport` props.

---

## Canonical models

### `SwimlaneModel` (M)

Root timeline document: `processes[]`, `minTime`, `maxTime` (**nanoseconds**), optional `metadata`.

**Why:** Single contract for every adapter. Shared swimlane UI and renderer depend only on this shape ([ARCHITECTURE](ARCHITECTURE.md)). Adapters convert CSV µs / Chrome Trace units into ns before UI.

### `SwimProcess` / `SwimThread` / `SwimEvent` (M)

- **Process** — Card / top group: `id`, `name`, optional `utilization`, `threads[]` (通信 / 计算 / 储存HBM / flat CTEF lanes)
- **Thread** — lane or nested folder: `id`, `name`, optional `utilization`, `events[]`, optional `children[]`
  - **Leaf** = no / empty `children` → paints events (may be `[]` spacer)
  - **Folder** = non-empty `children` → lane-style gutter row (chevron + util); events ignored
- **Event** — interval: `id`, `name`, `startTime`, `duration`, optional `dependencies`, `args`

**Why:** Matches sketch Card → category → Core → pipe hierarchy. Only Card uses group-header chrome. Optional `args` / `dependencies` hold format extras. Missing utilization → gutter without bars. Flat CTEF stays valid (no `children`).

### `ReportViewModel` (M)

OP-report analytics bundle: `summary`, `pipeOccupancy[]`, optional `overviewSeries[]`, and later optional sections for P2 panels.

**Why:** Separates Ascend OP report chrome from the timeline. PyPTO-only hosts can omit it; `.rep` adapter always fills what CSVs allow.

### `SummaryMetrics` (M)

Op name/type, task duration, optional raw frequency fields. Compute / bandwidth / avg util fields remain optional and **unset under Interim [I-Q6a](../context/INTERIM_DECISIONS.md)** until Q6 / data spec.

**Why:** `StatsSummaryPanel` must not invent formulas; adapter only maps clear columns.

### `PipeOccupancyItem` (M)

`{ id, label, ratio, colorKey, side?: 'cube' | 'vector' }` for PIPE bars. `colorKey` maps to [COLOR_TOKENS](../ui/COLOR_TOKENS.md).

**Why:** Stable panel props; color keys align gutter/timeline/legend without hard-coding hex in three places. M1 Cube|Vector toggle filters by `side`.

### `CsvTableModel` (M1)

`{ fileName, headers: string[], rows: Record<string, string>[], blockIds: string[] }` for searchable detail tabs. Adapter also exposes raw CSV text for 查看全部.

**Why:** One panel component serves PipeUtilization / ArithmeticUtilization / ResourceConflictRatio / Memory* / L2Cache.

### `OverviewSeries` (M)

`{ id, label, points: { t, v }[] }` for Cube/Vector overview charts.

**Why:** Isolates [Q5](../context/OPEN_QUESTIONS.md) (time-series source). `OverviewCharts` hides when the array is empty instead of blocking MVP.

### `SwimlaneViewState` (M / M2)

Visible `[startTime, endTime]`, `scrollY`, `selectedEventId`, `hoveredEventId`, `searchQuery`, aside visibility. **M2:** `measureMode: boolean`, `measureRange: { startUs: number, endUs: number } | null`.

**Why:** Interaction state is not part of the immutable report model; unit-testable; host may persist zoom/selection. Measure range is local until [Q22](../context/OPEN_QUESTIONS.md).

### `SelectedEvent` (M)

Emit payload: `id`, `name`, `startTime`, `duration`, `endTime`, optional `args` subset.

**Why:** Stable MSTT/host contract for selection without exposing full `SwimEvent` mutability.

### `ReportCapability` (M)

String union flags, e.g. `roofline` | `dependencies` | `memoryDiagram` | `hardwareDetails` | `sourceTab` | `cacheTab` | `aicpu`.

**Why:** Feature gating without `if (format === 'pypto')` in components. Host/adapter declares what data exists.

### `RepManifest` / `RepEmbeddedFile` (M, adapter-internal)

Parsed `.rep` file table (name, type, origin, offset, length) before decoding payloads.

**Why:** Keeps binary container details ([REP_FORMAT](../formats/REP_FORMAT.md)) out of Vue and out of `SwimlaneModel`.

### Not in shared core

- Insight `.bin` structures — stay in MindStudio Insight.
- PyPTO Mix/wrap/AICPU-specific graphs — live in a future adapter’s private types until mapped into `SwimEvent` / capabilities.

---

## Adapters and renderer (non-Vue)

### `RepAdapter` (M)

`ArrayBuffer` → `{ swimlaneModel, reportModel, capabilities? }`.

**Why:** First and only v1 adapter; sole module that knows CSVs + embedded `trace.json`.

### `ChromeTraceToSwimlane` (M)

Chrome Trace Event Format → `SwimlaneModel`.

**Why:** Shared by `RepAdapter` and any later adapter that already has CTEF (including a thin PyPTO path).

### `SwimlaneRenderer` interface (M)

```ts
interface SwimlaneRenderer {
  setModel(model: SwimlaneModel): void;
  setView(view: { startTime: number; endTime: number; scrollY: number }): void;
  render(): void;
  hitTest(x: number, y: number): string | null; // event id
  dispose(): void;
}
```

**Why:** Swap Canvas ↔ WebGL without rewriting `SwimlaneCanvas` or e2e selectors on Vue chrome ([SWIMLANE_IMPLEMENTATIONS](../archive/research/SWIMLANE_IMPLEMENTATIONS.md)).

### `CanvasSwimlaneRenderer` (M)

Canvas 2D implementation of `SwimlaneRenderer`. Uniform `#1f1f1f` event-sequence backgrounds (no zebra) with `#3a3a3a` row dividers aligned to the gutter.

**Why:** Adequate for sample-scale traces; ships MVP.

### `WebGlSwimlaneRenderer` (P2 → implemented)

WebGL2 coverage-AA interval backend (Sudu-inspired). Same uniform lane fill and 1px dividers as Canvas. Used by default from `SwimlaneCanvas` with a Canvas2D overlay for labels/selection/cursor; falls back to `CanvasSwimlaneRenderer` when WebGL2 is unavailable.

**Why:** Named interface stays stable; WebGL path ships for dense traces.

---

## Vue components

### `ProfilingReport` (M)

Root entry: accepts `source` (bytes / parsed rep) **or** prebuilt `swimlaneModel` / `reportModel`, plus `theme`, `locale`, `capabilities`. Owns `SwimlaneViewState`. Emits `ready` | `select` | `error` | `open-hardware-details` | `open-pipe-details` (forwarded from StatsAside).

**Why:** Single integration surface for MSTT (and later hosts). Encapsulates adapter invocation when `source` is provided.

### `ReportToolbar` (M / M2)

Search, zoom slider, zoom-to-fit, toggle stats aside. **M2:** measure-mode (度量模式) caliper toggle.

**Why:** Chrome must not sit inside the canvas hit-test path; matches FEATURE_MATRIX toolbar.

### `ReportLayout` (M)

CSS grid: gutter | main | aside (+ detail strip region).

**Why:** Implements sketch regions ([UI_OVERVIEW](../ui/UI_OVERVIEW.md)) without coupling panel internals.

### `LaneGutter` (M)

Hierarchical expand/collapse labels and utilization mini-bars, scroll-synced with the timeline. Open-angle stroke chevrons on groups and lanes; util % inside pill bars. Row `#3a3a3a` bottom borders align with swimlane horizontal dividers. Spec: [`LaneGutter.spec.md`](../../src/ui/TimelineView/SwimlaneView/LaneGutter/LaneGutter.spec.md).

**Why:** DOM text for a11y/i18n; avoids baking labels into WebGL. Hierarchy comes from `SwimProcess` / `SwimThread`.

### `TimeAxis` (M)

Ticks and playhead aligned to `SwimlaneViewState` time window. Canonical times are **nanoseconds**; **display unit is configurable** ([Q14](../context/OPEN_QUESTIONS.md)). **Interim MVP ([I-Q14](../context/INTERIM_DECISIONS.md)):** ms / µs / ns only; default **ms**; no clock-cycle mode.

**Why:** Shared alignment for overview charts and swimlane; playhead per INTERACTIONS.

### `OverviewCharts` (M)

Renders `OverviewSeries` (Cube/Vector); **hidden** when empty.

**Why:** MVP feature in sketches; hiding when empty avoids blocking on unresolved series math (Q5).

### `SwimlaneCanvas` (M / M2)

Mounts `SwimlaneRenderer`, maps pointer events to `hitTest`, updates hover/selection in view state. **M2:** when `measureMode`, drag sets `measureRange`; draws shaded band + Δt; pan-drag suppressed.

**Why:** Thin Vue wrapper over imperative rendering — keeps LOD/WebGL out of the Vue reactivity graph.

### `EventTooltip` (M)

Hover overlay: name, start, duration, end.

**Why:** Required by [INTERACTIONS](../ui/INTERACTIONS.md); portal/overlay so it is not clipped by canvas.

### `DetailPanel` (M)

Selection details dock. MVP shows **DetailSummary** (name + timing); Parameter and Relevant columns are P2 stubs with design crops.

**Why:** Delivers select→detail without waiting on dependency data (Q9). Full dock chrome matches `v930/detail-strip-raised`.

### `StatsAside` (M / M1)

Right analytics column. **Shell:** title + chart icon, close (X) → emit `close` (parent clears `asideVisible`), hardware meta one-liner (核数 / aic频率 / NPU ARCH when present), **更多** → open interim `HardwareDetailsPanel` when data exists (I-Q7a) and emit `open-hardware-details`. **Stacked report:** duration card, Roofline (M2 interim I-Q11*) when points exist, PIPE occupancy (+ Cube|Vector for MIX) with **详情** → compute CSV overlay, MemoryTopologyPanel with **详情** → memory CSV overlay. No mode-tab switcher. Overlay header **←** returns to the stack.

**Why:** Single aside host for report chrome and analytics modes; emits keep hide/hardware intent out of presentational children.

### `StatsSummaryPanel` (M)

Cards from `SummaryMetrics`.

**Why:** Report-specific; omit when `reportModel` is absent.

### `PipeOccupancyPanel` (M / M1)

Horizontal bars from `PipeOccupancyItem[]`. **M1:** Cube | Vector segmented control when `OpType == MIX` ([`v930/compute-load`](../ui/source/v930/compute-load.jpeg)).

**Why:** Highest-value `.rep` analytics panel in sketches; data from `PipeUtilization.csv` via adapter.

### `CsvFieldListPanel` (M1)

Searchable field list with CSV tabs, optional block switcher, **查看全部** emit (`view-full-csv`). Used for compute-load details (#3) and memory details (#4).

**Why:** One reusable panel for all M1 CSV drill-downs; hide empty tabs.

### `RooflinePanel` (M2)

Log-log roofline chart from `RooflineViewModel` (I-Q11a–f interim). Axes Ops/Byte × TOps/s; roof polyline; GM point(s); op-mix labels; hover tooltip. No tabs until I-Q11f superseded. Mounted on the StatsAside stacked report after the duration card; hide when no points.

**Why:** FEATURE_MATRIX / sketches; interim math unblocks M2 while Q11 open.

### `MemoryTopologyPanel` (M2)

Static SVG memory path diagram with **data-driven edge labels** from Memory* CSVs ([Q12](../context/OPEN_QUESTIONS.md), changelog #5). Mounted on the stacked 报告统计 below PIPE; **详情** opens the memory CSV overlay.

**Why:** Geometry stays in the SVG asset; labels from adapter mapping table.

### `HardwareDetailsPanel` (M1 interim I-Q7a)

Sectioned key–value list from `HardwareDetailsModel`. Prefer HardwareInfo.jsonl; else OpBasicInfo. Never invent peaks/cores/HBM.

**Why:** 更多 drill-down while Product Q7 inventory remains open.

### `DependencyLinksLayer` (P2)

Bezier/dep overlays above or beside intervals.

**Why:** Separate from interval fill so Canvas/WebGL backends stay simple; needs dep encoding (Q9).

### `ContextMenu` / `MultiSelectSummary` (P2)

Pin/context actions and multi-select aggregate table.

**Why:** Listed in FEATURE_MATRIX; not MVP.

---

## Explicitly out of this library

| Concern | Owner |
|---------|--------|
| VS Code performance explorer / tree | MSTT host |
| Secondary tabs OP算子 / 源码 / 详情 / 缓存 (beyond Timeline shell) | Host or later library tab strip (P2 product decision) |
| Insight `.bin` viewing | MindStudio Insight |
| PyPTO compute-graph three-column shell | pypto-tools until/unless adapted |

---

## Related docs

- [ARCHITECTURE.md](ARCHITECTURE.md) — packaging and adapter strategy
- [FEATURE_MATRIX.md](../ui/FEATURE_MATRIX.md) — MVP vs P2 features
- [VIEW_DATA_REQUIREMENTS.md](../formats/VIEW_DATA_REQUIREMENTS.md) — per-view inputs
- [COLOR_TOKENS.md](../ui/COLOR_TOKENS.md) — normative colors
- [UX_SPEC.md](../ui/UX_SPEC.md) — scenarios and sync model
- [INTERACTIONS.md](../ui/INTERACTIONS.md) — hover/select/zoom behavior
- [METRICS_AND_TRACE.md](../formats/METRICS_AND_TRACE.md) — `.rep` embeds → report model fields
- [SWIMLANE_IMPLEMENTATIONS.md](../archive/research/SWIMLANE_IMPLEMENTATIONS.md) — Canvas vs WebGL
