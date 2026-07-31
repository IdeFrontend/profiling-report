# Project Goals

## Problem

MSTT (Huawei OP DevTools) visualizes operator profiling through an externally downloaded **MindStudio Insight** shell (`InsightDataViewerPanel` + `profiler_server`). PyPTO Toolkit provides a richer, swimlane-centric timeline experience that feels native to the VS Code plugin.

Operators and toolkit teams want a **unified profiling UX** for OP development: a pypto-like swimlane timeline plus report analytics, delivered as a reusable component that MSTT can own and evolve without shipping the full Insight stack for the new report format.

Domain background (who develops what, pain points, glossary): [DOMAIN_AND_USERS.md](DOMAIN_AND_USERS.md).

**“Unified UX” means shared swimlane/report components and format adapters** — not one uber-viewer that replaces Insight, swallows all PyPTO schedule features, and handles every on-disk format as a single product mode. See [ARCHITECTURE.md](../specs/architecture/ARCHITECTURE.md).

## Goals

1. Provide a **reusable Vue 3 library** (shared UI + `.rep` adapter first) that renders Ascend / CANN operator profiling reports (`.rep` / `.ncrep`).
2. Align visual and interaction patterns with **PyPTO swimlane** (timeline, lanes, zoom/pan, selection, detail panels) while matching the product sketches in [`docs/specs/ui/`](../specs/ui/).
3. Integrate first into **MSTT** as a first-party webview panel, sibling to Insight — not injected into Insight iframes.
4. Keep **msinsight** as the viewer for legacy **`.bin`** (and existing Insight JSON/DB workflows) until those formats are retired separately.
5. Allow **copy-paste** of useful pieces from PyPTO; **do not** require changes to the pypto plugin for v1.
6. Leave the door open for optional later reuse by **pypto-tools** via an adapter into the same canonical models, without requiring pypto changes for MVP.

## Non-goals (v1)

- Building an **uber-viewer** that natively unifies Insight operator `.bin`, full PyPTO swimGraph feature surface, and `.rep` as one combinatorial component.
- Replacing all MindStudio Insight modes (system Timeline, cluster Summary/Communication, serving, memory leaks).
- Full PyPTO feature parity (PMU tabs, AICPU E2E mode, Mix/wrap, three-column compute-graph linkage, SQLite cache, `@pypto/data-compress`).
- Publishing a sealed HTML webview bundle as the primary packaging form (see architecture: Vue library).
- Depending on `sudu-editor` binaries or TeaVM toolchain.
- Modifying pypto-tools, msinsight, or sudu-editor repositories as part of this project’s delivery.
- Parsing Insight `.bin` inside this library.

## Consumers

| Consumer | Priority | Integration style |
|----------|----------|-------------------|
| **MSTT** (`mstt`) | Primary | Import Vue components into existing Vite webview panels; open `.rep`/`.ncrep` from performance results tree |
| **pypto-tools** | Optional later | May consume the library or remain on its own swimGraph; no pypto changes required for this project’s MVP |
| Standalone / browser demo | Nice-to-have | Host can feed `ArrayBuffer` or parsed models without VS Code APIs |

## Success criteria (MVP)

- Unpack and interpret sample [`data/out.rep`](../../data/out.rep) (CSVs + Chrome Trace).
- Render timeline swimlane with hierarchical lanes, time axis, zoom/pan, hover tooltip, and single-event selection details.
- Show report summary stats and PIPE occupancy derived from embedded CSVs.
- MSTT can open a `.rep` / `.ncrep` file into a profiling-report panel while `.bin` continues to open Insight.

## Phasing

| Phase | Intent |
|-------|--------|
| **MVP** | Narrow viewer: timeline shell + swimlane + core stats/PIPE + basic interactions (see [FEATURE_MATRIX.md](../specs/ui/FEATURE_MATRIX.md)) |
| **Phase 2+** | Remaining sketch features remain **in product scope**: roofline, memory topology, hardware sidebar, dependency graph, multiselect, source/details/cache tabs, etc. |

## Design references

- Domain / users / glossary: [DOMAIN_AND_USERS.md](DOMAIN_AND_USERS.md)
- UI sketches: [`docs/specs/ui/*.png`](../specs/ui/)
- UX specification: [UX_SPEC.md](../specs/ui/UX_SPEC.md)
- Feature phasing: [FEATURE_MATRIX.md](../specs/ui/FEATURE_MATRIX.md)
- Components & models: [COMPONENTS.md](../specs/architecture/COMPONENTS.md)
- Sample report: [`data/out.rep`](../../data/out.rep)
- Prior PyPTO reuse research (archive): [SWIMLANE_WEBVIEW_REUSE_REPORT.md](../research/SWIMLANE_WEBVIEW_REUSE_REPORT.md)
- Swimlane tech comparison: [SWIMLANE_IMPLEMENTATIONS.md](../research/SWIMLANE_IMPLEMENTATIONS.md)
