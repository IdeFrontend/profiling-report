# Reusable Components and Models

Normative catalog of models, adapters, renderer APIs, and Vue components for the profiling-report library. Aligns with [ARCHITECTURE.md](ARCHITECTURE.md) (shared UI + adapters) and [FEATURE_MATRIX.md](../ui/FEATURE_MATRIX.md).

**Legend:** **M** = MVP · **P2** = Phase 2+ (named now; not required to implement yet)

## Layering

```text
adapters (core)  →  canonical models  →  Vue ui + swimlane renderer
```

| Layer | Ships | Public? |
|-------|-------|---------|
| Adapters | Format → models | Yes (hosts may pre-parse) |
| Models / types | Canonical DTOs + capabilities | Yes |
| `SwimlaneRenderer` | Imperative timeline backend | Yes (advanced hosts) |
| Vue UI | `ProfilingReport` and panels | Yes — `ProfilingReport` is the default host entry |

```text
ProfilingReport
├─ ReportToolbar
├─ ReportLayout (gutter | main | aside)
│  ├─ LaneGutter
│  ├─ SwimlanePane
│  │  ├─ OverviewCharts
│  │  ├─ TimeAxis
│  │  └─ SwimlaneCanvas  →  SwimlaneRenderer
│  ├─ StatsAside
│  │  ├─ StatsSummaryPanel
│  │  └─ PipeOccupancyPanel
│  └─ DetailStrip
└─ EventTooltip (overlay)
```

## Design principles

1. **Models are format-agnostic; adapters are format-specific.** UI never switches on “`.rep` vs PyPTO”.
2. **One interactive timeline surface** (`SwimlaneRenderer`). Lane labels, tooltips, and gutters stay DOM where possible (a11y, i18n, hit-testing simplicity).
3. **Report panels consume view-models**, not CSV column names or raw Chrome Trace events.
4. **Compose small components** — avoid a god-root like PyPTO `swimGraphComplete.vue`.
5. **P2 names freeze the roadmap** without blocking MVP API freeze for core models and `ProfilingReport` props.

---

## Canonical models

### `SwimlaneModel` (M)

Root timeline document: `processes[]`, `minTime`, `maxTime`, optional `metadata`.

**Why:** Single contract for every adapter. Shared swimlane UI and renderer depend only on this shape ([ARCHITECTURE](ARCHITECTURE.md)).

### `SwimProcess` / `SwimThread` / `SwimEvent` (M)

- **Process** — group (e.g. Kernel / AIV0): `id`, `name`, `threads[]`
- **Thread** — lane: `id`, `name`, optional `utilization` (0..1 for gutter bars), `events[]`
- **Event** — interval: `id`, `name`, `startTime`, `duration`, optional `dependencies`, `args`

**Why:** Matches pypto-like hierarchy. Optional `args` and `dependencies` hold format-specific extras (seqNo, pipe flags, etc.) without polluting required fields. Missing utilization → gutter without bars.

### `ReportViewModel` (M)

OP-report analytics bundle: `summary`, `pipeOccupancy[]`, optional `overviewSeries[]`, and later optional sections for P2 panels.

**Why:** Separates Ascend OP report chrome from the timeline. PyPTO-only hosts can omit it; `.rep` adapter always fills what CSVs allow.

### `SummaryMetrics` (M)

Op name/type, task duration, frequencies, and placeholder fields for compute / bandwidth / avg util (exact formulas still open — [Q6](../../context/OPEN_QUESTIONS.md)).

**Why:** `StatsSummaryPanel` must not import CSV header strings; adapter performs aggregation.

### `PipeOccupancyItem` (M)

`{ id, label, ratio, colorKey }` for PIPE bars (Cube, Vector, MTE*, …).

**Why:** Stable panel props; color keys align gutter/timeline/legend without hard-coding hex in three places.

### `OverviewSeries` (M)

`{ id, label, points: { t, v }[] }` for Cube/Vector overview charts.

**Why:** Isolates [Q5](../../context/OPEN_QUESTIONS.md) (time-series source). `OverviewCharts` hides when the array is empty instead of blocking MVP.

### `SwimlaneViewState` (M)

Visible `[startTime, endTime]`, `scrollY`, `selectedEventId`, `hoveredEventId`, `searchQuery`, aside visibility.

**Why:** Interaction state is not part of the immutable report model; unit-testable; host may persist zoom/selection.

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

**Why:** Swap Canvas ↔ WebGL without rewriting `SwimlaneCanvas` or e2e selectors on Vue chrome ([SWIMLANE_IMPLEMENTATIONS](../../research/SWIMLANE_IMPLEMENTATIONS.md)).

### `CanvasSwimlaneRenderer` (M)

Canvas 2D implementation of `SwimlaneRenderer`.

**Why:** Adequate for sample-scale traces; ships MVP.

### `WebGlSwimlaneRenderer` (P2)

WebGL2 coverage-AA interval backend (Sudu-inspired).

**Why:** Named now so the interface stays stable when density requires it.

---

## Vue components

### `ProfilingReport` (M)

Root entry: accepts `source` (bytes / parsed rep) **or** prebuilt `swimlaneModel` / `reportModel`, plus `theme`, `locale`, `capabilities`. Owns `SwimlaneViewState`. Emits `ready` | `select` | `error`.

**Why:** Single integration surface for MSTT (and later hosts). Encapsulates adapter invocation when `source` is provided.

### `ReportToolbar` (M)

Search, zoom slider, zoom-to-fit, toggle stats aside.

**Why:** Chrome must not sit inside the canvas hit-test path; matches FEATURE_MATRIX toolbar MVP.

### `ReportLayout` (M)

CSS grid: gutter | main | aside (+ detail strip region).

**Why:** Implements sketch regions ([UI_OVERVIEW](../ui/UI_OVERVIEW.md)) without coupling panel internals.

### `LaneGutter` (M)

Hierarchical expand/collapse labels and utilization mini-bars, scroll-synced with the timeline.

**Why:** DOM text for a11y/i18n; avoids baking labels into WebGL. Hierarchy comes from `SwimProcess` / `SwimThread`.

### `TimeAxis` (M)

Millisecond ticks and playhead aligned to `SwimlaneViewState` time window.

**Why:** Shared alignment for overview charts and swimlane; playhead per INTERACTIONS.

### `OverviewCharts` (M)

Renders `OverviewSeries` (Cube/Vector); **hidden** when empty.

**Why:** MVP feature in sketches; empty state avoids blocking on unresolved series math (Q5).

### `SwimlaneCanvas` (M)

Mounts `SwimlaneRenderer`, maps pointer events to `hitTest`, updates hover/selection in view state.

**Why:** Thin Vue wrapper over imperative rendering — keeps LOD/WebGL out of the Vue reactivity graph.

### `EventTooltip` (M)

Hover overlay: name, start, duration, end.

**Why:** Required by [INTERACTIONS](../ui/INTERACTIONS.md); portal/overlay so it is not clipped by canvas.

### `DetailStrip` (M)

Selection summary (name + timing). Compact strip for MVP (full bottom dock / deps graph → P2).

**Why:** Delivers select→detail without waiting on dependency data (Q9).

### `StatsSummaryPanel` (M)

Cards from `SummaryMetrics`.

**Why:** Report-specific; omit when `reportModel` is absent.

### `PipeOccupancyPanel` (M)

Horizontal bars from `PipeOccupancyItem[]`.

**Why:** Highest-value `.rep` analytics panel in sketches; data from `PipeUtilization.csv` via adapter.

### `RooflinePanel` (P2)

Log-log roofline chart.

**Why:** Named for FEATURE_MATRIX / sketches; needs formula clarity (Q11).

### `MemoryTopologyPanel` (P2)

Memory path diagram + optional field list.

**Why:** Named stub; driven by `Memory*.csv` later.

### `HardwareDetailsPanel` (P2)

Host/NPU/HBM inventory.

**Why:** Depends on metadata source ([Q7](../../context/OPEN_QUESTIONS.md)).

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
- [INTERACTIONS.md](../ui/INTERACTIONS.md) — hover/select/zoom behavior
- [METRICS_AND_TRACE.md](../formats/METRICS_AND_TRACE.md) — `.rep` embeds → report model fields
- [SWIMLANE_IMPLEMENTATIONS.md](../../research/SWIMLANE_IMPLEMENTATIONS.md) — Canvas vs WebGL
