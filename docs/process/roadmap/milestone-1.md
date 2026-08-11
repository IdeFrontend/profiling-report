# Milestone 1 — Max support of repo demo data

**Status:** **Completed 2026-08-11**. Progress report: [M1_PROGRESS.md](M1_PROGRESS.md).

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

Design frames: [`v930/compute-load`](../../ui/source/v930/compute-load.jpeg) (Cube|Vector), [`v930/compute-load-detail`](../../ui/source/v930/compute-load-detail.jpeg), [`v930/memory-load-detail`](../../ui/source/v930/memory-load-detail.jpeg) (tabs + block + 查看全部).

| View | Status | Features |
|------|--------|----------|
| Report summary | **Extend** | All non-empty `OpBasicInfo` columns in fixture. Hide synthetic TFLOPS / BW / avg-util |
| PIPE occupancy | **Extend** | Mean non-`NA` pipe-family bars (I-Q6b); **Cube \| Vector toggle for MIX** ops (#2); non-MIX shows relevant side only; hide if missing/all NA |
| PIPE / compute details | **New** | Detail tabs: `PipeUtilization` \| `ArithmeticUtilization` \| `ResourceConflictRatio` (#3); searchable field lists; show `NA` |
| Memory (field list) | **New** | Tabs: Memory L1 / L2Cache / Memory L0 / Memory UB (#4); **block** switcher (I-Q6c); **查看全部** opens full CSV in new tab (I-Q6d) |
| Memory graph / topology chart | **Out** | → [M2](milestone-2.md) (`MemoryTopologyPanel`, changelog #5) |
| Cache | **New** | Covered by memory detail **L2Cache** tab (aside mode may alias) |
| Metrics | **New** | Covered by compute detail **ArithmeticUtilization** + **ResourceConflictRatio** tabs |
| Roofline | **Out** | → [M2](milestone-2.md) |
| Hardware aside / secondary tabs | **Out** | → [M3](milestone-3.md) |
| Rich details panel (dep mini-graph) | **Out** | Compact strip only in M1 → [M2](milestone-2.md) |

## Implementation tasks

1. Spec: extend [VIEW_DATA_REQUIREMENTS](../../formats/VIEW_DATA_REQUIREMENTS.md) / [FEATURE_MATRIX](../../ui/FEATURE_MATRIX.md) / [COMPONENTS](../../architecture/COMPONENTS.md) for aside modes + CSV tabs + Cube/Vector toggle + block/查看全部; assign `PR-*` test ids.
2. Adapter: parse remaining `out.rep` CSVs into typed tables (`ArithmeticUtilization`, `L2Cache`, `Memory*`, `ResourceConflictRatio`); extend `OpBasicInfo` → summary fields; keep hide-if-empty.
3. Domain: `ReportViewModel` holds table models, block ids, MIX pipe sets, which aside modes/tabs are available.
4. UI: aside mode switcher; Cube/Vector control; compute detail tabs; memory tabs + block picker + 查看全部 emit; reusable searchable field-list.
5. i18n keys (zh-CN default) for new labels; playground verifies all modes on `out.rep` and hide on `out.trace.json`; playground opens CSV blob on 查看全部.
6. Tests: unit parse/adapt; component tabs/toggle/block/search; e2e mode switch on fixture; CI green.
7. Docs: sync Readme / DEVELOPMENT status; note M1 = demo-data completeness (no MSTT).

## Potential blockers

| Blocker | Impact | Mitigation |
|---------|--------|------------|
| No column semantics / units for many CSV fields (producer spec WIP) | Labels may be raw header names only | Ship raw headers + values; polish labels when format spec arrives |
| Which rows to show (per `block_id` vs aggregate) | Wrong UX for multi-block fixture | **I-Q6c**: mean bars + block-scoped details with picker |
| Sketches for pipe/memory **lists** exist; Metrics/Cache aside chrome less specified | Layout guesswork | Mirror changelog tabs + `source/v930/compute-load-detail.jpeg` list pattern |
| Q6 still interim — cannot show TFLOPS/BW tiles | Summary incomplete vs sketches | Explicitly out of M1; do not invent formulas |
| Q5 — no `OverviewSeries` in fixture | Overview charts stay empty | Keep hidden (already decided) |
| Dense/wide CSVs may hurt aside UX | Scroll/search only | Search + virtualize if needed; no chart derivation in M1 |

## Exit criteria

- `out.rep`: Summary / PIPE (with Cube/Vector when MIX) / compute detail tabs / Memory tabs + block + 查看全部 show fixture values; swimlane keep still green
- `out.trace.json`: swimlane works; other-view modes without CSVs hidden
- Every `out.rep` CSV parsed into a view-model or documented unused; specs + CI green
- Memory **graph chart** not required for M1 exit