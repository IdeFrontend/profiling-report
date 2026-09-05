# M1 Progress Report

**Project:** `@huawei/profiling-report` — Vue 3 library for Ascend/CANN OP profiling report visualization  
**Period:** Project inception through 2026-08-11  
**Report date:** 2026-08-11  
**Status:** Delivery Milestone 1 completed

---

## 1. Project Overview

The profiling-report library provides a swimlane timeline and report analytics panel for NPU operator profiling data. It ingests `.rep`/`.ncrep` binary containers and standalone Chrome Trace Event Format (CTEF) JSON files, rendering an interactive timeline alongside compute load, pipe occupancy, and memory detail views.

The primary consumer is **MSTT** (Huawei OP DevTools), which will embed the library as a native webview panel. The project follows a spec-driven TDD workflow: domain specs (`specs/core/`) drive unit tests via traceable `PR-*` test IDs, and co-located component specs drive Vue SFC tests.

---

## 2. Library Milestones 1–4 (Completed)

These four infrastructure milestones were completed before the M1 delivery work began. They established the library scaffold, data pipeline, swimlane renderer, and MVP UI shell.

### LM1 — Scaffold

| Item | Artifacts |
|------|-----------|
| Vite library build pipeline | `vite.config.ts`, `tsconfig.lib.json` |
| Vitest (unit + component) | `vitest.config.ts`, happy-dom environment |
| Playwright (E2E) | `playwright.config.ts`, `tests/e2e/` |
| Playground dev server | `playground/` (App.vue, main.ts, index.html, vite.config.ts) |
| ESLint + vue-tsc typecheck | `eslint.config.js`, `tsconfig.app.json` |
| CI pipeline | `.github/workflows/ci.yml` (lint → typecheck → check-specs → check-design → test → E2E) |
| Golden test fixture | `data/out.rep`, `data/out.trace.json` |
| Traceability validation | `scripts/check-spec-coverage.mjs` |

Test coverage: PR-SCAFFOLD-001..004 (unit, component, E2E) — all green.

### LM2 — Parse, View Models, UI Shell

| Item | Artifacts |
|------|-----------|
| Binary `.rep` parser | `src/adapters/parseRep.ts` — reads `CannRepHead` (36 bytes) + `CannRepFileInfo` (160 bytes each) + payloads |
| REP format specification | `specs/core/rep-format.spec.md`, `specs/core/input-formats.spec.md` (PR-FMT-001..003) |
| Chrome Trace → SwimlaneModel | `src/adapters/chromeTraceToSwimlane.ts` — groups X events by pid/tid, us-to-ns conversion (PR-SWIM-001..005) |
| Report view model adaptation | `src/adapters/adaptRep.ts` — `adaptRep()` builds `ReportViewModel` + `SwimlaneModel` from parsed `.rep` |
| Domain types | `src/domain/types.ts` — `SwimlaneModel`, `ReportViewModel`, `SummaryMetrics`, `PipeOccupancyItem`, `SwimlaneViewState` |
| ProfilingReport root component | `src/ui/ProfilingReport/ProfilingReport.vue` — orchestrates swimlane + toolbar + aside |
| ReportLayout shell | `src/ui/ReportLayout/ReportLayout.vue` — timeline + aside layout |
| Public API barrel | `src/index.ts` — exports `ProfilingReport`, `parseRep`, `adaptRep`, `loadReportSource`, `chromeTraceToSwimlane`, all types |

Test coverage: PR-FMT-001..003, PR-VM-001..003, PR-SWIM-001..005, PR-UI-001..003 — all green.

### LM3 — Canvas Renderer + Navigation

| Item | Artifacts |
|------|-----------|
| Imperative Canvas 2D renderer | `src/swimlane/CanvasSwimlaneRenderer.ts` — lane layout, event rects, color assignment, hit testing (PR-RENDER-001..005) |
| WebGL2 hybrid renderer | `src/swimlane/WebGlSwimlaneRenderer.ts` — interval fills with Canvas overlay; Canvas fallback when WebGL2 unavailable |
| SwimlaneCanvas Vue wrapper | `src/ui/TimelineView/SwimlaneView/SwimlaneCanvas/` — binds canvas lifecycle to Vue component |
| Time formatting | `src/domain/formatTime.ts` — `formatTime`, `formatAxisTime`, `formatCursorTime` in ms/us/ns (PR-TIME-001..004) |
| View state management | `src/domain/viewState.ts` — `createViewState`, `zoomAt`, `panBy`, `zoomToFitWindow` (PR-VIEW-001..005) |
| Toolbar | `src/ui/ReportToolbar/ReportToolbar.vue` — search, zoom in/out, zoom-to-fit, aside toggle, time-unit selector |
| Time axis ruler | `src/ui/TimelineView/TimeAxis/AxisRuler/AxisRuler.vue` — tick marks linked to visible window |
| Panel resize | `src/ui/panelResize.ts` — aside/timeline splitter |
| Lane utilization colors | `src/domain/laneColors.ts` — color mapping by thread name patterns |

Test coverage: PR-RENDER-001..005, PR-TIME-001..004, PR-VIEW-001..005 — all green.

### LM4 — Trace JSON Support + MVP Polish

| Item | Artifacts |
|------|-----------|
| Standalone Chrome Trace JSON | `src/adapters/loadReportSource.ts` — detects binary `.rep` vs CTEF JSON, adapts accordingly (PR-JSON-001..002) |
| `emptyReportViewModel()` | `src/adapters/adaptRep.ts` — empty analytics model for JSON-only loads (shows Swimlane only, no aside) |
| Gutter utilization mini-bars | `src/domain/utilization.ts` — `computeThreadUtilization`, `withDerivedUtilizations` (PR-UTIL-001..002) |
| Lane gutter | `src/ui/TimelineView/SwimlaneView/LaneGutter/LaneGutter.vue` — hierarchical lane labels + utilization bars |
| Time display unit | `TimeScaleUnit` (`s` / `ms` / `us` / `ns`) — auto-scaled from viewport span and overview axis density; optional CPU-clocks mode (`TimeDisplayMode`) when OpBasicInfo freq present |
| Event tooltip | `src/ui/EventTooltip/EventTooltip.vue` — hover shows name, start, duration, end |
| Compact detail strip | `src/ui/DetailPanel/DetailPanel.vue` — single-select event details |
| i18n scaffolding | `src/i18n/index.ts` — `t()` function, zh-CN default, en fallback |
| CSS design tokens | `src/ui/tokens.css` — `--pr-bg-panel`, `--pr-playhead`, `--pr-color-*` variables |
| Time overview bar | `src/ui/TimelineView/TimeOverviewBar/TimeOverviewBar.vue` — brush zoom linked to visible window |
| Report aside shell | `src/ui/StatsAside/StatsAside.vue` — thin summary cards (op name, type, duration) + initial PIPE bars |

Test coverage: PR-JSON-001..002, PR-UTIL-001..002, PR-UI-001..008, PR-E2E-001..006 — all green.

---

## 3. M1 Delivery Milestone (Target: 2026-08-11)

**Goal:** Playground on `data/out.rep` surfaces every usable embed. Timeline shell only, no MSTT.

The M1 milestone extends the "Other views" aside panel based on design frames [`v930/compute-load`](../../ui/source/v930/compute-load.jpeg), [`v930/compute-load-detail`](../../ui/source/v930/compute-load-detail.jpeg), [`v930/memory-load-detail`](../../ui/source/v930/memory-load-detail.jpeg) (changelog items #2–#4):

- **#2** — PIPE occupancy with Cube | Vector toggle for MIX ops  
- **#3** — Compute detail tabs (PipeUtilization / ArithmeticUtilization / ResourceConflictRatio)  
- **#4** — Memory detail tabs (Memory L1 / L2Cache / Memory L0 / Memory UB) with block switcher and 查看全部  

### Task 1: Specifications — COMPLETED (2026-08-07)

Extended existing specs and created new ones to define M1 behavior:

| Spec File | Changes |
|-----------|---------|
| `specs/core/view-models.spec.md` | Added PR-VM-006 (computeTables for PipeUtilization/ArithmeticUtilization/ResourceConflictRatio), PR-VM-007 (memoryTables for Memory.csv/L2Cache/MemoryL0/MemoryUB with csvTexts), pipe `side` field |
| `specs/core/integration.spec.md` | Added PR-UI-008 (CSV-only report auto-opens aside and shows toggle) |
| `src/ui/StatsAside/StatsAside.spec.md` | New PR-STATS-001..005: mode switcher, PIPE bars, Cube|Vector toggle for MIX, unrecognized opType shows all sides, compute/memory CSV tabs with view-full-csv emit |
| `src/ui/StatsAside/CsvFieldListPanel/CsvFieldListPanel.spec.md` | New PR-CSV-001..004: tab switching, block switcher, search filter, 查看全部 emit |

### Task 2: Adapter — COMPLETED (2026-08-07)

`src/adapters/adaptRep.ts` now handles all 9 embedded files from `data/out.rep`:

| CSV File | Processing |
|----------|------------|
| `OpBasicInfo.csv` | Extended to include `currentFreq` and `ratedFreq` fields in `SummaryMetrics` |
| `PipeUtilization.csv` | Side-specific pipe occupancy with separate `aic_*` (Cube) and `aiv_*` (Vector) column families |
| `ArithmeticUtilization.csv` | Parsed into `CsvTableModel` with block IDs — compute detail tab |
| `ResourceConflictRatio.csv` | Parsed into `CsvTableModel` with block IDs — compute detail tab |
| `Memory.csv` | Parsed into `CsvTableModel` with block IDs — memory tab (MemoryL1) |
| `L2Cache.csv` | Parsed into `CsvTableModel` with block IDs — memory tab (L2Cache) |
| `MemoryL0.csv` | Parsed into `CsvTableModel` with block IDs — memory tab (MemoryL0) |
| `MemoryUB.csv` | Parsed into `CsvTableModel` with block IDs — memory tab (MemoryUB) |
| `trace.json` | Unchanged from LM2 — swimlane source |

Key additions:
- `collectCsvTables()` — generic CSV → `CsvTableModel` converter with `blockIds` extraction from rows
- `csvTexts` map — raw CSV text by filename for 查看全部 (DATA-33d)
- `reportModelFromParsed()` — collects compute tables (3 files) and memory tables (4 files)

### Task 3: Domain Types — COMPLETED (2026-08-07)

`src/domain/types.ts` extended:

```typescript
interface CsvTableModel {
  fileName: string;
  headers: string[];
  rows: Record<string, string>[];
  blockIds: string[];
}

interface ReportViewModel {
  // ... existing summary, pipeOccupancy, overviewSeries ...
  computeTables: CsvTableModel[];
  memoryTables: CsvTableModel[];
  csvTexts: Record<string, string>;
}

interface PipeOccupancyItem {
  // ... existing id, label, ratio, colorKey ...
  side?: 'cube' | 'vector';  // M1 Cube|Vector toggle grouping
}
```

### Task 4: UI Components — COMPLETED (2026-08-07)

#### StatsAside (`src/ui/StatsAside/StatsAside.vue`)

- **Mode switcher**: Summary / PIPE / Compute / Memory tabs, shown only when data available
- **Summary mode**: Op name, type, duration, frequency metadata
- **PIPE mode**: Bar chart with per-family utilization ratios, Cube | Vector toggle appears only when `opType === 'MIX'`; non-MIX ops show the relevant side only; blank/unrecognized opType shows all sides
- **Compute mode**: Hosts `CsvFieldListPanel` with PipeUtilization / ArithmeticUtilization / ResourceConflictRatio tabs
- **Memory mode**: Hosts `CsvFieldListPanel` with MemoryL0 / L2Cache / MemoryL1 / MemoryUB tabs
- Emits `view-full-csv` for CSV export

#### CsvFieldListPanel (`src/ui/StatsAside/CsvFieldListPanel/CsvFieldListPanel.vue`)

- **CSV tabs**: Lists available tables by filename, product label mapping (e.g., `Memory.csv` → "MemoryL1")
- **Block switcher**: `<select>` picker filtered by `block_id` column (DATA-33c)
- **Search**: Filters field header names (case-insensitive substring)
- **Field list**: Shows header → value pairs for the selected block/row with literal `NA` display
- **查看全部 button**: Emits `view-full-csv` with `{ fileName, text }` for full CSV export (DATA-33d)

### Task 5: i18n — COMPLETED (2026-08-07)

`src/i18n/index.ts` was extended with all M1 keys:

| Key | zh-CN | en |
|-----|-------|-----|
| `block` | block | block |
| `viewAll` | 查看全部 | View all |
| `modeSummary` | 摘要 | Summary |
| `modePipe` | PIPE | PIPE |
| `modeCompute` | 计算负载 | Compute load |
| `modeMemory` | 内存负载 | Memory load |
| `computeAnalysis` | 计算负载分析 | Compute load analysis |
| `memoryAnalysis` | 内存负载分析 | Memory load analysis |

Default locale is zh-CN per interim decision PKG-2.

### Task 6: Tests — COMPLETED (2026-08-07)

#### Unit tests (`tests/unit/viewModels.spec.ts`)

- **PR-VM-006**: Verifies computeTables contain PipeUtilization, ArithmeticUtilization, ResourceConflictRatio with correct headers (block_id), 8 rows, and block IDs 0-7
- **PR-VM-007**: Verifies memoryTables contain MemoryL0, L2Cache, Memory, MemoryUB with correct block IDs and csvTexts mapping; verifies csvTexts include compute tables too

#### Component tests (`src/ui/StatsAside/StatsAside.spec.ts`)

- **PR-STATS-001**: Summary cards render with op name visible
- **PR-STATS-002**: PIPE occupancy bars render with percentage values
- **PR-STATS-003**: Cube|Vector toggle appears only for MIX, filters bars by side, non-MIX shows only relevant side
- **PR-STATS-004**: Blank/unrecognized opType shows all PIPE sides without toggle
- **PR-STATS-005**: Compute/memory modes show CSV tabs, 查看全部 emits view-full-csv with correct fileName + text, tab label mapping verified (Memory.csv → MemoryL1)

#### Component tests (`src/ui/StatsAside/CsvFieldListPanel/CsvFieldListPanel.spec.ts`)

- **PR-CSV-001**: Tabs render and switch the visible field list
- **PR-CSV-002**: Block switcher filters rows by block_id
- **PR-CSV-003**: Search filters field labels (case-insensitive substring)
- **PR-CSV-004**: 查看全部 emits view-full-csv with fileName + text

#### Integration (`tests/component/ProfilingReport.feature.spec.ts`)

- **PR-UI-008**: CSV-only report (compute/memory tables, no summary/pipe) auto-opens aside and shows toggle

All listed tests pass.

### Task 7: Documentation — COMPLETED (2026-08-11)

- [x] Sync `Readme.md` with M1 status — updated Status section with completed M1 items and M2 target
- [x] Update `docs/process/DEVELOPMENT.md` with M1 milestone completion — marked D1 as completed, set M2 as next
- [x] Create this M1 progress report — `docs/process/roadmap/M1_PROGRESS.md`

---

## 4. Summary

| # | Task | Status | Artifacts |
|---|------|--------|-----------|
| 1 | Specs | **Completed** | PR-VM-006/007, PR-STATS-001..005, PR-CSV-001..004, PR-UI-008 |
| 2 | Adapter | **Completed** | `adaptRep.ts` — all 9 CSVs parsed, csvTexts for 查看全部 |
| 3 | Domain types | **Completed** | `types.ts` — `CsvTableModel`, computeTables, memoryTables, csvTexts, pipe side |
| 4 | UI components | **Completed** | `StatsAside.vue` (mode switcher, MIX toggle, compute/memory hosts), `CsvFieldListPanel.vue` (tabs, block, search, 查看全部) |
| 5 | i18n | **Completed** | 8 new keys: block, viewAll, modeSummary/Pipe/Compute/Memory, computeAnalysis, memoryAnalysis |
| 6 | Tests | **Completed** | PR-VM-006/007, PR-STATS-001..005, PR-CSV-001..004, PR-UI-008 — all passing |
| 7 | Docs | **Completed** | Readme, DEVELOPMENT, this progress report |

### Overall M1 progress: 100% (7/7 tasks complete)

---

## 5. M1 Exit Criteria Status

| Criterion | Status |
|-----------|--------|
| `out.rep`: Summary shows op name, type, duration, freq | **Done** |
| `out.rep`: PIPE occupancy bars with Cube/Vector toggle for MIX | **Done** |
| `out.rep`: Compute detail tabs (PipeUtilization / ArithmeticUtilization / ResourceConflictRatio) | **Done** |
| `out.rep`: Memory tabs (L0 / L2Cache / L1 / UB) with block switcher and 查看全部 | **Done** |
| `out.rep`: Swimlane functionality preserved (Keep) | **Done** |
| `out.trace.json`: Swimlane works, other-view modes hidden | **Done** (aside modes omit when no CSV) |
| Every `out.rep` CSV parsed into a view-model or documented unused | **Done** (all 8 CSVs parsed) |
| Specs + CI green | **Done** (`npm run ci` / GitHub Actions on `master`) |
| Memory graph chart not required for M1 exit | **By design** (deferred to M2) |

---

## 6. Deferred to M2/M3

The following features were explicitly excluded from M1 and are deferred:

| Feature | Target |
|---------|--------|
| Memory graph / topology chart | M2 |
| Roofline analysis | M2 |
| Rich details panel (dep mini-graph) | M2 |
| Multi-select / dependencies / context menu | M2 |
| Hardware aside / secondary tabs | M3 |
| ProfilerStep / W/S/A/D keyboard shortcuts | M3 |
| MSTT host integration | M2 |

---

## 7. Known Limitations

1. **No MSTT integration tested** — Spec exists (`specs/architecture/mstt-integration.spec.md`) but integration testing requires the MSTT host.
2. **CSV column semantics undocumented** — Many fields ship with raw header names only (producer spec is still WIP). Label polish deferred to format spec arrival.
3. **No E2E tests for M1 UI** — Existing E2E tests (PR-E2E-001..006) cover LM4 features. New M1 aside modes (compute/memory tabs, block switcher, 查看全部) lack dedicated E2E tests (covered by component tests PR-STATS-* / PR-CSV-*).

---

## 8. File Manifest

### Source files changed in M1

| File | Type |
|------|------|
| `src/adapters/adaptRep.ts` | Adapter — CSV parsing extended |
| `src/domain/types.ts` | Types — CsvTableModel, extended ReportViewModel |
| `src/ui/StatsAside/StatsAside.vue` | Component — mode switcher, MIX toggle, compute/memory hosts |
| `src/ui/StatsAside/CsvFieldListPanel/CsvFieldListPanel.vue` | Component — new reusable CSV panel |
| `src/i18n/index.ts` | i18n — 8 new keys |

### Spec files changed in M1

| File | Type |
|------|------|
| `specs/core/view-models.spec.md` | Spec — PR-VM-006/007, pipe side |
| `specs/core/integration.spec.md` | Spec — PR-UI-008 |
| `src/ui/StatsAside/StatsAside.spec.md` | Spec — PR-STATS-001..005 |
| `src/ui/StatsAside/CsvFieldListPanel/CsvFieldListPanel.spec.md` | Spec — PR-CSV-001..004 |

### Test files changed in M1

| File | Type |
|------|------|
| `tests/unit/viewModels.spec.ts` | Unit — PR-VM-006/007 |
| `src/ui/StatsAside/StatsAside.spec.ts` | Component — PR-STATS-001..005 |
| `src/ui/StatsAside/CsvFieldListPanel/CsvFieldListPanel.spec.ts` | Component — PR-CSV-001..004 |
| `tests/component/ProfilingReport.feature.spec.ts` | Integration — PR-UI-008 |

---

## 9. Related docs

- Process / TDD workflow: [DEVELOPMENT.md](../DEVELOPMENT.md), [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md)
- Renderer strategy (Canvas + WebGL hybrid): [COMPONENTS.md](../../architecture/COMPONENTS.md), [SWIMLANE_IMPLEMENTATIONS.md](../../archive/research/SWIMLANE_IMPLEMENTATIONS.md)
- Next milestone: [milestone-2.md](milestone-2.md)

---

*Report date 2026-08-11. Next milestone target: 2026-08-25 (M2).*
