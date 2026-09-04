# Milestone 2 — MSTT host + selection + details + memory graph + roofline

**Target date:** **2026-08-25**

**Goal:** (1) Ship M1 library into MSTT. (2) Swimlane selection with prev/next dependency lines and a details panel. (3) Memory topology **graph chart** with real edge values ([`v930/memory-load-detail`](../../ui/source/v930/memory-load-detail.jpeg)). (4) **Roofline** panel from fixture arithmetic data (interim formulas if DATA-37 still open). (5) Timeline **time-range measure / 度量模式** ([`v930/task-measure-mode`](../../ui/source/v930/task-measure-mode.jpeg); local overlay only — aside not recomputed). Spec host: [MSTT_INTEGRATION.md](../../architecture/MSTT_INTEGRATION.md).

**Data note:** `out.rep` has no deps — ship interim DATA-36 encoding + synthetic playground fixture for CI; swap adapter when Product finalizes DATA-36.

Index: [README.md](README.md) · Previous: [milestone-1.md](milestone-1.md)

## Swimlane

| Item | Status | Features |
|------|--------|----------|
| MSTT open path | **New (host)** | `.rep` / `.ncrep` / Chrome Trace `.json` → profiling-report; `.bin` → Insight; tree discovers `.rep`/`.ncrep` |
| M1 swimlane runtime in host | **Ship** | Gutter, canvas, zoom/pan, search, tooltip; smoke on real OP + fixture |
| Selection emphasis | **Extend** | Click select; dim non-selected when links shown; clear on empty; hover stays tooltip-only |
| Prev/next dependency lines | **New** | Bezier/curves in `WebGlSwimlaneRenderer` / `CanvasSwimlaneRenderer`; track zoom/pan/scroll; toolbar mode/depth; no-op if no deps |
| Time-range measure (度量模式) | **New** | Toolbar caliper; drag `[t0,t1]` on timeline; shaded band + Δt label; clear on toggle-off / Esc. **Does not** change viewport. **Does not** recompute the aside — local overlay only |
| Multiselect / context menu / ProfilerStep / W/S/A/D / WebGL | **Out** | → [M3](milestone-3.md) |

## Other views

| Item | Status | Features |
|------|--------|----------|
| M1 aside modes in MSTT | **Ship** | Summary / PIPE / compute details / Memory tabs when CSVs present; hidden for trace-only JSON; host opens **查看全部** CSV in editor tab (DATA-33d) |
| Host chrome | **New (host)** | i18n, load errors; capability flags; workspace dep (I-PKG-1) |
| Details panel | **New** | Replaces compact strip: name + timing; incoming/current/outgoing mini-graph with depth filters; raw args when present; hide when no selection |
| Memory graph chart | **New** | `MemoryTopologyPanel`: static SVG topology + **data-driven edge labels** from Memory* CSVs (UI-38 + changelog #5). Hide if no memory CSVs. Edge thickness static. Optional: hover/click syncs field-list rows |
| Roofline | **New** | `RooflinePanel`: log-log bottleneck chart from `ArithmeticUtilization.csv` (+ related fields); sketches `source/v930/entry.jpeg` / `source/v930/entry.jpeg` / `source/v930/report-stats-open.jpeg`. Hide if no usable points. Capability flag `roofline` |
| Overview / DATA-33 tiles / secondary tabs | **Out** | → [M3](milestone-3.md) |

## Implementation tasks

1. **Deps (library):** Document interim DATA-36 encoding (e.g. `SwimEvent.dependencies: string[]` successor ids, or Chrome Trace `args` convention); add synthetic fixture with known edges; adapter fills model.
2. **Deps UI:** draw curves in `WebGlSwimlaneRenderer` / `CanvasSwimlaneRenderer` on selection; toolbar mode/depth; spec + crops in `DependencyLinksLayer/`; tests.
3. **Details panel:** Replace/extend `DetailPanel` → selection details (timing + in/current/out mini-graph + depth filters); wire to `selectedEventId`.
4. **Memory graph:** Author/adapt static SVG topology asset; map Memory* CSV columns → edge label slots (document mapping table in VIEW_DATA_MAPPING); `MemoryTopologyPanel` in Memory aside with M1 field lists; tests on `out.rep`.
5. **Roofline:** Spec interim point/ceiling mapping from `ArithmeticUtilization` (and peaks if present) while DATA-37 open; implement `RooflinePanel` (hover points, hide if empty); wire aside/capability; tests on `out.rep`.
6. **Time-range measure:** Toolbar toggle + `measureMode` / `measureRange` in view-state; canvas overlay (band + Δt); pan suppressed while measuring; no aside recompute; tests.
7. **MSTT host (separate repo):** workspace dep; scan `.rep`/`.ncrep`; open dispatch; panel mount `<ProfilingReport>`; theme/locale; open 查看全部 CSV; smoke real OP + fixture.
8. Specs + CI for deps fixture, details panel, memory labels, roofline, measure overlay; host checklist in integration doc.

## Potential blockers

| Blocker | Impact | Mitigation |
|---------|--------|------------|
| **DATA-36 open** — no producer dep encoding; `out.rep` has zero deps | Cannot demo links on real sample | Interim encoding + synthetic fixture for CI; hide links when empty |
| No algorithm for “prev/next” if only unordered id lists | Wrong graph direction | Interim: directed successor list; predecessors = reverse index |
| Depth-filter semantics underspecified | Details mini-graph ambiguity | Match sketch defaults (both / forward / backward); document interim |
| **Memory edge ↔ CSV column mapping** not fully specified (UI-38 says labels data-driven, not which field → which edge) | Wrong/missing labels on graph | Engineering mapping table from sketch + CSV headers; Product confirm later |
| No official SVG topology asset in repo | Must draw from sketches | Create SVG from `source/v930/memory-load-detail.jpeg`; treat as product-owned asset |
| **DATA-37 roofline** formulas + peak ceilings still open | Cannot claim Product-final axes | Ship **interim** point derivation from `ArithmeticUtilization` columns; document I-*; hide panel if undecidable; swap when DATA-37 closes |
| Roofline peak bandwidth / compute ceilings not in fixture | Roof lines missing | Interim constants or omit roofs until Product supplies peaks |
| **MSTT repo access / review lag** | Host PR slips past 2026-08-25 | Start dep wiring early; parallel library work; slip host only if needed |
| Workspace/Vite resolve of library SFCs | Integration burns days | Follow `StTestResultsPanel` pattern ([MSTT_INTEGRATION](../../architecture/MSTT_INTEGRATION.md)) |
| Package name / I-PKG-1 not confirmed with MSTT | Wrong consume path | Default workspace path protocol; rename later |
| Real OP `.rep` differs from `out.rep` | Host smoke fails | Library follow-up; hide missing panels |
| PKG-3 Legal if copying PyPTO dep-link code verbatim | Blocks paste | Reimplement curves; no pypto runtime dep |
| Selection + MSTT + memory graph + roofline + measure in one milestone | Schedule risk | Parallelize: library selection/memory/roofline/measure vs host PR |

## Exit criteria

- MSTT: open `.rep`/`.ncrep`/trace JSON into panel; Insight for `.bin`; M1 aside modes when data exists
- Playground fixture with deps: select → prev/next lines + details panel with in/current/out neighbors
- Toggle hides links; clear selection clears panel; `out.rep` without deps still safe
- `out.rep`: Memory aside shows **graph chart** with labels from fixture Memory* CSVs
- `out.rep`: Roofline panel shows when interim points can be derived; otherwise hidden with documented reason
- Measure mode: toolbar → drag range → shaded band + Δt; clear works; aside unchanged for the measured range
- Specs + tests for interim DATA-36, memory topology labels, interim roofline, measure overlay, and host smoke