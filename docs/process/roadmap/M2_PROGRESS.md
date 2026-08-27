# M2 Progress Report

**Project:** `@huawei/profiling-report` — Vue 3 library for Ascend/CANN OP profiling report visualization  
**Period:** 2026-08-11 (M1 complete) through 2026-08-24  
**Report date:** 2026-08-24  
**Status:** Delivery Milestone 2 **near complete** — library exit criteria met on `master`; MSTT host **Ready** on branch [`feature/profiling-report`](https://github.com/IdeFrontend/mstt/tree/feature/profiling-report) (PR pending merge)

---

## 1. Project Overview

M2 extends the M1 demo-data library into an MSTT-embeddable product with swimlane selection dependencies, a rich details dock, memory topology graph, interim roofline, and timeline measure mode (度量模式).

**Goal (from [milestone-2.md](milestone-2.md)):** (1) Ship M1 library into MSTT. (2) Swimlane selection with prev/next dependency lines and a details panel. (3) Memory topology **graph chart** with data-driven edge values. (4) **Roofline** panel from fixture arithmetic data (interim I-Q11). (5) Timeline **time-range measure** (local overlay until Q22).

Design frames: [`v930/task-measure-mode`](../../ui/source/v930/task-measure-mode.jpeg), [`v930/memory-load-detail`](../../ui/source/v930/memory-load-detail.jpeg), [`v930/task-click-detail`](../../ui/source/v930/task-click-detail.jpeg). Host spec: [MSTT_INTEGRATION.md](../../architecture/MSTT_INTEGRATION.md).

---

## 2. M2 Implementation Tasks

Mapped to [milestone-2.md § Implementation tasks](milestone-2.md):

| # | Task | Status | Primary artifacts / PRs |
|---|------|--------|-------------------------|
| 1 | **Deps (library)** — interim Q9 encoding + synthetic fixture | **Done** | `chromeTraceToSwimlane.ts` (`args.dependencies`), `playground/depsFixture.ts`, `specs/core/dependencies.spec.md` |
| 2 | **Deps UI** — curves, toolbar mode/depth, selection dim | **Done** | [#15](https://github.com/IdeFrontend/profiling-report/pull/15) (Pavel Pertsev) |
| 3 | **Details panel** — timing + in/current/out mini-graph | **Done** | [#17](https://github.com/IdeFrontend/profiling-report/pull/17) (Kirill Aleshin) |
| 4 | **Memory graph** — SVG topology + CSV edge labels | **Done** | [#16](https://github.com/IdeFrontend/profiling-report/pull/16), [#21](https://github.com/IdeFrontend/profiling-report/pull/21) (Mikhail Protasov) |
| 5 | **Roofline** — interim I-Q11 point/ceiling mapping | **Done** | `adaptRep.rooflineFromCsv`, `RooflinePanel.vue`; scaffold [#9](https://github.com/IdeFrontend/profiling-report/pull/9), wiring #16/#21 |
| 6 | **Time-range measure** — toolbar, band, Δt, no aside sync | **Done** | [#13](https://github.com/IdeFrontend/profiling-report/pull/13), [#28](https://github.com/IdeFrontend/profiling-report/pull/28) (Anatoly Nikitin) |
| 7 | **MSTT host** (separate repo) | **Ready** | [`mstt` branch `feature/profiling-report`](https://github.com/IdeFrontend/mstt/tree/feature/profiling-report) (Anatoly Nikitin) — PR pending |
| 8 | **Specs + CI** | **Done** | 320 tests on `master`; co-located specs for deps, topology, roofline, measure |

### Overall M2 progress: **7/8 tasks complete**, task 7 **Ready** (host branch), smoke **pending**

---

## 3. Completed Work on `master`

### 3.1 Swimlane

| M2 item | PR | Author | Merged |
|---------|-----|--------|--------|
| **Prev/next dependency lines** + toolbar mode/depth + selection dim | [#15](https://github.com/IdeFrontend/profiling-report/pull/15) | **Pavel Pertsev** | 2026-08-19 |
| **Details panel** — in/current/out mini-graph, depth filters, resizable dock | [#17](https://github.com/IdeFrontend/profiling-report/pull/17) | **Kirill Aleshin** | 2026-08-21 |
| **Time-range measure (度量模式)** — toolbar, band, Δt, magnet, edge resize | [#13](https://github.com/IdeFrontend/profiling-report/pull/13), [#28](https://github.com/IdeFrontend/profiling-report/pull/28) | **Anatoly Nikitin** | 2026-08-23 |
| **Selection emphasis** (dim non-linked events) | part of #15 | Pavel Pertsev | 2026-08-19 |
| Interim **Q9 deps encoding** + synthetic playground fixture | `playground/depsFixture.ts`, adapter in #15 | Anatoly Nikitin / #15 | — |
| Card→Core gutter hierarchy (MSTT layout prep) | [#12](https://github.com/IdeFrontend/profiling-report/pull/12) | Anatoly Nikitin | 2026-08-12 |
| Cursor/axis aligned to producer trace timestamps | [#27](https://github.com/IdeFrontend/profiling-report/pull/27) | Anatoly Nikitin | 2026-08-24 |
| WebGL swimlane renderer (foundation) | [#8](https://github.com/IdeFrontend/profiling-report/pull/8) | Pavel Pertsev | 2026-08-10 |

Key modules: `src/swimlane/dependencyLinks.ts`, `DependencyLinksLayer/`, `DetailPanel/DetailRelevant/`, `viewState.ts` (`measureMode`, `measureRange`).

### 3.2 Other views

| M2 item | PR | Author | Merged |
|---------|-----|--------|--------|
| **Memory topology graph** — `MemoryTopologyPanel`, `buildMemoryTopology`, data-driven edge labels | [#16](https://github.com/IdeFrontend/profiling-report/pull/16), [#21](https://github.com/IdeFrontend/profiling-report/pull/21) | **Mikhail Protasov** | 2026-08-14 / 2026-08-21 |
| **Roofline panel** — interim I-Q11 in `adaptRep.rooflineFromCsv`, log-log chart | [#9](https://github.com/IdeFrontend/profiling-report/pull/9); wiring #16/#21 | Mikhail Protasov | 2026-08-10–21 |
| Stacked **报告统计** aside (duration → roofline → PIPE → topology) | #16 | Mikhail Protasov | 2026-08-14 |
| I/O bandwidth cards (I-Q6g, adjacent polish) | [#18](https://github.com/IdeFrontend/profiling-report/pull/18) | Mikhail Protasov | 2026-08-19 |
| PIPE card v930 styling | [#19](https://github.com/IdeFrontend/profiling-report/pull/19) | Mikhail Protasov | 2026-08-20 |

Key modules: `src/adapters/memoryTopology.ts`, `src/ui/StatsAside/MemoryTopologyPanel/`, `src/ui/StatsAside/RooflinePanel/`.

### 3.3 Library host-prep

| Item | PR | Author | Notes |
|------|-----|--------|-------|
| Public API contract pinned | [#26](https://github.com/IdeFrontend/profiling-report/pull/26) | Anatoly Nikitin | `specs/architecture/public-api.spec.md` |
| npu-rep multi-OP container + OP selector | [#20](https://github.com/IdeFrontend/profiling-report/pull/20) | Anatoly Nikitin | Real OP smoke enabler |
| Capabilities auto-derived | `adaptRep.ts` | — | `roofline`, `memoryDiagram`, `dependencies` |

**Regression:** `docs/usage/USAGE.md` was added in #26 and removed again in #20 — restore in a follow-up PR.

### 3.4 Docs / process (supporting M2)

| PR | Author | Topic |
|----|--------|-------|
| #25 | Mikhail Protasov | HQ open questions split (data vs UI/UX) |
| #21 | Mikhail Protasov | Right-panel field mappings + topology label docs |
| #22 | Mikhail Protasov | English-only PR/commit titles rule |

**CI on `master`:** 320 tests passing (41 files), GitHub Actions green on latest merges.

---

## 4. Open PRs (this repo — not yet on `master`)

| PR | Author | M2 relevance | Status |
|----|--------|--------------|--------|
| [#29](https://github.com/IdeFrontend/profiling-report/pull/29) — stable narrow-panel layout for MSTT embedding | Anatoly Nikitin | **Critical for MSTT UX** — aside/gutter layout, canvas track width, timeline scroll | Open |
| [#23](https://github.com/IdeFrontend/profiling-report/pull/23) — Time vs CPU clocks | Anatoly Nikitin | **Stretch** — replaces ms/µs/ns dropdown; not in M2 exit criteria | Open |
| [#30](https://github.com/IdeFrontend/profiling-report/pull/30) — HQ mockup links + annotated crops | Anatoly Nikitin | Product/docs support; not blocking code exit | Open |

**Recommended merge order:** #29 → #23 / #30 (optional polish).

---

## 5. MSTT Host — Ready (`feature/profiling-report`)

MSTT integration is **implemented and ready** on branch [`feature/profiling-report`](https://github.com/IdeFrontend/mstt/tree/feature/profiling-report) in the [`IdeFrontend/mstt`](https://github.com/IdeFrontend/mstt) repo (**Anatoly Nikitin**). GitHub PR not yet opened at report date; submodule tracks profiling-report `master` plus open #29 layout fixes.

Checklist from [MSTT_INTEGRATION.md § Required MSTT changes](../../architecture/MSTT_INTEGRATION.md):

| Checklist item | Status |
|----------------|--------|
| Scan `.rep`/`.ncrep` in performance tree | **Ready** (host branch) |
| Open dispatch (`.rep`/`.ncrep`/trace `.json` → profiling-report; `.bin` → Insight) | **Ready** (host branch) |
| Panel registration + submodule / workspace dep on profiling-report | **Ready** (host branch) |
| Mount `<ProfilingReport>`; theme/locale/i18n | **Ready** (host branch) |
| `view-full-csv` → editor tab | **Ready** (host branch) |
| Smoke: real OP + `out.rep` fixture | **Pending** — post-merge manual verification |

Notable host commits: `feat: integrate profiling-report submodule for .rep/.ncrep viewer`, `feat: open any .rep/.ncrep file via command and context menu`, `fix: full-height profiling-report panel layout`, `docs: document profiling-report integration`.

Library-side enablers already merged: #26 (API contract), #20 (multi-OP). Still open and recommended before/with host merge: #29 (narrow-panel layout).

---

## 6. M2 Exit Criteria Status

From [milestone-2.md § Exit criteria](milestone-2.md):

| Criterion | Status |
|-----------|--------|
| Playground deps fixture: select → links + details in/out neighbors | **Done** |
| Toggle hides links; clear clears panel; `out.rep` without deps safe | **Done** |
| `out.rep`: memory graph with CSV-driven labels | **Done** |
| `out.rep`: roofline when interim points derivable | **Done** |
| Measure mode: toolbar → drag → band + Δt; no aside sync (Q22) | **Done** |
| Specs + tests for Q9, topology, roofline, measure | **Done** |
| **MSTT:** open `.rep`/`.ncrep`/trace JSON; Insight for `.bin`; M1 aside when data exists | **Ready** — [`mstt` `feature/profiling-report`](https://github.com/IdeFrontend/mstt/tree/feature/profiling-report) |
| **Host smoke** on real OP + fixture | **In progress** — blocked on host PR merge + manual pass |

---

## 7. Known Limitations & Blockers

1. **Q9 still open** — `out.rep` has zero real dependency edges; CI and playground demo use `playground/depsFixture.ts` only.
2. **Q11 interim** — roofline uses fallback peak constants (`ROOFLINE_PEAK_*`); Product-final formulas deferred to M3.
3. **Q22 blocked** — measure overlay is local only; aside panels do not recompute for the measured range.
4. **`USAGE.md` regression** — consumer guide from #26 removed in #20; `public-api.spec.md` remains canonical.
5. **M2 closure path** — merge library #29, open/merge MSTT host PR, run smoke on real OP + `out.rep`.

---

## 8. Contributors

| Person | GitHub | Primary M2 contributions |
|--------|--------|----------------------------|
| **Anatoly Nikitin** | nikitinas | Measure mode, MSTT library prep + host branch, npu-rep, cursor fix, gutter hierarchy; open PRs #29, #23, #30 |
| **Mikhail Protasov** | mprotasov | Memory topology + stacked aside, roofline wiring, bandwidth/PIPE polish, HQ docs |
| **Pavel Pertsev** | pertsevpv | Swimlane dependency links + WebGL foundation |
| **Kirill Aleshin** | ll1r1k-1337 | Detail dock rebuild with Relevent dependency mini-graph |

---

## 9. File Manifest (major M2 additions)

### Source

| File | Type |
|------|------|
| `src/adapters/memoryTopology.ts` | Adapter — CSV → topology edge labels |
| `src/swimlane/dependencyLinks.ts` | Domain — link geometry + hop walk |
| `src/ui/StatsAside/MemoryTopologyPanel/` | Component — static SVG + data labels |
| `src/ui/StatsAside/RooflinePanel/` | Component — log-log roofline chart |
| `src/ui/DetailPanel/DetailRelevant/` | Component — in/current/out dep graph |
| `src/ui/TimelineView/SwimlaneView/DependencyLinksLayer/` | Component — curve overlay |
| `playground/depsFixture.ts` | Fixture — synthetic Q9 dependency chain |

### Specs

| File | Type |
|------|------|
| `specs/core/dependencies.spec.md` | Spec — interim Q9 encoding |
| `src/ui/StatsAside/MemoryTopologyPanel/MemoryTopologyPanel.spec.md` | Spec — PR-TOPO-* |
| `src/ui/StatsAside/RooflinePanel/RooflinePanel.spec.md` | Spec — PR-ROOF-* |
| `src/ui/DetailPanel/DetailPanel.spec.md` | Spec — PR-DEPGRAPH-* |
| `src/ui/TimelineView/SwimlaneView/DependencyLinksLayer/DependencyLinksLayer.spec.md` | Spec — PR-DEPLINK-* |

---

## 10. Related docs

- Previous milestone: [M1_PROGRESS.md](M1_PROGRESS.md), [milestone-1.md](milestone-1.md)
- Scope / exit criteria: [milestone-2.md](milestone-2.md)
- Host wiring: [MSTT_INTEGRATION.md](../../architecture/MSTT_INTEGRATION.md)
- Next milestone: [milestone-3.md](milestone-3.md)

---

*Report date 2026-08-24. M2 target: 2026-08-25. Library ~90% on exit criteria; MSTT host Ready on branch; smoke pending.*
