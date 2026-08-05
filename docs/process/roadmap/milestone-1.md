# Milestone 1 — Max support of repo demo data

**Target date:** **2026-08-11**

**Goal:** Playground on [`data/out.rep`](../../../data/out.rep) surfaces every usable embed. Timeline shell only (no secondary tabs). No MSTT.

**Principle:** Raw / clearly labeled fixture fields only — no invented Q6 tiles, overview series, or roofline.

Index: [README.md](README.md)

## Swimlane

| Item | Status | Features |
|------|--------|----------|
| Shell + toolbar | **Keep** | Open `out.rep` / `out.trace.json`; aside toggle; search; zoom / zoom-to-fit; time unit ms/µs/ns |
| Time axis + overview brush | **Keep** | Linked to visible window |
| Cube/Vector overview charts | **Stay hidden** | No `OverviewSeries` in fixture (Q5) |
| Lane gutter | **Keep** | Hierarchy from fixture names; util mini-bars when mapped |
| Canvas + tooltip + compact detail strip | **Keep** | Hover (name/start/dur/end); single-select → strip; clear on empty click |
| Deps / multiselect / context menu / ProfilerStep / W/S/A/D | **Out** | Selection + deps + details → [M2](milestone-2.md); rest → [M3](milestone-3.md) |

## Other views

Aside mode switcher: **Summary** | **PIPE** | **Pipe details** | **Memory** | **Cache** | **Metrics** (omit modes with no data).

| View | Status | Features |
|------|--------|----------|
| Report summary | **Extend** | All non-empty `OpBasicInfo` columns in fixture. Hide synthetic TFLOPS / BW / avg-util |
| PIPE occupancy | **Keep** | Mean non-`NA` pipe-family bars; hide if missing/all NA |
| PIPE details | **New** | Searchable raw `PipeUtilization` field list; show `NA` |
| Memory (field list) | **New** | Searchable Memory / MemoryL0 / MemoryUB field lists from fixture CSVs |
| Memory graph / topology chart | **Out** | → [M2](milestone-2.md) (`MemoryTopologyPanel`, sketch `memory_chart.png`) |
| Cache | **New** | Searchable `L2Cache` field list (aside mode, not 缓存 tab) |
| Metrics | **New** | Field lists for `ArithmeticUtilization` + `ResourceConflictRatio` (no roofline) |
| Roofline | **Out** | → [M2](milestone-2.md) |
| Hardware aside / secondary tabs | **Out** | → [M3](milestone-3.md) |
| Rich details panel (dep mini-graph) | **Out** | Compact strip only in M1 → [M2](milestone-2.md) |

## Implementation tasks

1. Spec: extend [VIEW_DATA_REQUIREMENTS](../../specs/formats/VIEW_DATA_REQUIREMENTS.md) / [FEATURE_MATRIX](../../specs/ui/FEATURE_MATRIX.md) / [COMPONENTS](../../specs/architecture/COMPONENTS.md) for aside modes + generic CSV field-list panel; assign `PR-*` test ids.
2. Adapter: parse remaining `out.rep` CSVs into typed tables (`ArithmeticUtilization`, `L2Cache`, `Memory*`, `ResourceConflictRatio`); extend `OpBasicInfo` → summary fields; keep hide-if-empty.
3. Domain: `ReportViewModel` (or sibling) holds table models + which aside modes are available.
4. UI: aside mode switcher; `PipeDetailsPanel`; reusable searchable field-list for Memory / Cache / Metrics; extend `StatsSummaryPanel`.
5. i18n keys (zh-CN default) for new labels; playground verifies all modes on `out.rep` and hide on `out.trace.json`.
6. Tests: unit parse/adapt; component field-list/search; e2e mode switch on fixture; CI green.
7. Docs: sync Readme / DEVELOPMENT status; note M1 = demo-data completeness (no MSTT).

## Potential blockers

| Blocker | Impact | Mitigation |
|---------|--------|------------|
| No column semantics / units for many CSV fields (producer spec WIP) | Labels may be raw header names only | Ship raw headers + values; polish labels when format spec arrives |
| Which rows to show (per `block_id` vs aggregate) undefined | Wrong UX for multi-block fixture | Interim: show all rows or first block + block picker; document I-* |
| Sketches for pipe/memory **lists** exist; Metrics/Cache aside chrome less specified | Layout guesswork | Mirror `pipe_details.png` list pattern for all field lists |
| Q6 still interim — cannot show TFLOPS/BW tiles | Summary incomplete vs sketches | Explicitly out of M1; do not invent formulas |
| Q5 — no `OverviewSeries` in fixture | Overview charts stay empty | Keep hidden (already decided) |
| Dense/wide CSVs may hurt aside UX | Scroll/search only | Search + virtualize if needed; no chart derivation in M1 |

## Exit criteria

- `out.rep`: Summary / PIPE / Pipe details / Memory **field lists** / Cache / Metrics show fixture values; swimlane keep still green
- `out.trace.json`: swimlane works; other-view modes without CSVs hidden
- Every `out.rep` CSV parsed into a view-model or documented unused; specs + CI green
- Memory **graph chart** not required for M1 exit
