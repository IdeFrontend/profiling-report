# Profiling Report — Documentation Index

English documentation for the reusable Vue profiling-report library. Formal behavioral contracts live in root [`specs/`](../specs/); this tree holds descriptive system/UX/format docs and design assets.

## Reading order

1. **[context/PROJECT_GOALS.md](context/PROJECT_GOALS.md)** — why this project exists, consumers, MVP vs later, success criteria
2. **[context/DOMAIN_AND_USERS.md](context/DOMAIN_AND_USERS.md)** — OP developers, pain points, glossary, link to UX scenarios
3. **[context/MARKET_AND_COMPETITORS.md](context/MARKET_AND_COMPETITORS.md)** — NVIDIA Nsight analogues, competitors, market frame
4. **[context/questions/](context/questions/)** — open questions (DATA/UI/PROC/PKG ids). Resolved answers: **[context/decisions/](context/decisions/)**
5. **[context/decisions/interim/](context/decisions/interim/)** — engineering defaults that unblock MVP coding (not Product-final)
6. **[process/DEVELOPMENT.md](process/DEVELOPMENT.md)** — top-down workflow: docs → specs → tests → code
7. **[process/roadmap/](process/roadmap/)** — delivery milestones to full UI (dates, tasks, blockers)
7. **[process/PROJECT_STRUCTURE.md](process/PROJECT_STRUCTURE.md)** — canonical project layout: spec locations, per-component folders, test ID conventions, traceability
8. **[process/TESTING.md](process/TESTING.md)** — Vitest / Playwright pyramid, fixtures, matrix → test ids
9. **[process/DEFINITION_OF_READY.md](process/DEFINITION_OF_READY.md)** — checklist before implementing a slice
10. **[formats/INPUT_FORMATS.md](formats/INPUT_FORMATS.md)** — **hub**: `.npu-rep` container + compute/emulate profile index
11. **[formats/FORMATS_COMPARISON.md](formats/FORMATS_COMPARISON.md)** — Insight vs hardware `.npu-rep` vs simulator `.npu-rep` vs PyPTO
12. **[formats/compute/FORMAT.md](formats/compute/FORMAT.md)** — hardware OP embed schemas
13. **[formats/compute/METRICS_AND_TRACE.md](formats/compute/METRICS_AND_TRACE.md)** — hardware embeds → UI
14. **[formats/emulate/FORMAT.md](formats/emulate/FORMAT.md)** — simulator contract + leaf pack
15. **[formats/ADAPTERS.md](formats/ADAPTERS.md)** — detect profile → adapt → view-models
16. **[formats/REP_FORMAT.md](formats/REP_FORMAT.md)** — classic `cann-rep` fixture only
17. **[formats/VIEW_DATA_REQUIREMENTS.md](formats/VIEW_DATA_REQUIREMENTS.md)** — adapted VM required/optional; hide-if-missing
18. **[ui/DESIGN_INDEX.md](ui/DESIGN_INDEX.md)** — design image hierarchy (sources → screens → component crops)
19. **[ui/UI_OVERVIEW.md](ui/UI_OVERVIEW.md)** — layout regions mapped to design sketches
20. **[ui/VIEW_DATA_MAPPING.md](ui/VIEW_DATA_MAPPING.md)** — UI section ↔ field ↔ source mappings (incl. simulator)
21. **[ui/COLOR_TOKENS.md](ui/COLOR_TOKENS.md)** — normative colors from sketches
22. **[ui/LOCALIZATION.md](ui/LOCALIZATION.md)** — zh-CN / en catalog, host `locale`, lane `categoryKey`
23. **[ui/UX_SPEC.md](ui/UX_SPEC.md)** — complete UX: scenarios (incl. S10 simulator), static vs interactive, sync model
24. **[ui/FEATURE_MATRIX.md](ui/FEATURE_MATRIX.md)** — MVP vs Phase 2+ feature list
25. **[ui/INTERACTIONS.md](ui/INTERACTIONS.md)** — hover, selection, multiselect, menus
26. **[architecture/ARCHITECTURE.md](architecture/ARCHITECTURE.md)** — Vue library: shared UI + format adapters, modules, data flow
27. **[architecture/COMPONENTS.md](architecture/COMPONENTS.md)** — reusable models, adapters, renderer, Vue component catalog
28. **[architecture/MSTT_INTEGRATION.md](architecture/MSTT_INTEGRATION.md)** — how MSTT opens `.npu-rep` / `.json` beside Insight
29. **[archive/research/SWIMLANE_IMPLEMENTATIONS.md](archive/research/SWIMLANE_IMPLEMENTATIONS.md)** — PyPTO Canvas vs Sudu WebGL vs hybrid

End-user guide (shipped with the demo): [https://profiling-report.vercel.app/guide/](https://profiling-report.vercel.app/guide/) (`playground/public/guide/`).

## Process

| Doc | Role |
|-----|------|
| [context/PROJECT_GOALS.md](context/PROJECT_GOALS.md) | Goals, non-goals, consumers, success criteria |
| [context/DOMAIN_AND_USERS.md](context/DOMAIN_AND_USERS.md) | Domain users, pain points, glossary → UX |
| [context/MARKET_AND_COMPETITORS.md](context/MARKET_AND_COMPETITORS.md) | NVIDIA Nsight analogues and competitor landscape |
| [context/questions/](context/questions/) | Open questions — DATA/UI/PROC/PKG ids, single status enum |
| [context/decisions/](context/decisions/) | Product-final decisions (resolved open questions, provenance) |
| [context/decisions/interim/](context/decisions/interim/) | Interim engineering defaults for MVP coding |
| [context/PACKAGING_SUGGESTIONS.md](context/PACKAGING_SUGGESTIONS.md) | PKG-1 … PKG-3 suggestions (interim until Product confirms); UI-41 resolved in [decisions/UI.md](context/decisions/UI.md) |
| [process/DEVELOPMENT.md](process/DEVELOPMENT.md) | Spec-driven TDD workflow, slice order, Definition of Done |
| [process/roadmap/](process/roadmap/) | Delivery milestones M1–M3 (dates, swimlane vs other views, tasks, blockers) |
| [process/TESTING.md](process/TESTING.md) | Unit / component / e2e stack and fixture rules |
| [process/DEFINITION_OF_READY.md](process/DEFINITION_OF_READY.md) | Pre-coding checklist per slice |

Executable test id catalog (after scaffold): [`tests/README.md`](../tests/README.md) (deprecated in favor of co-located component specs and [`specs/README.md`](../specs/README.md)).

## System docs (quick links)

| Doc | Role |
|-----|------|
| [ui/UX_SPEC.md](ui/UX_SPEC.md) | Scenarios S1–S10, static vs interactive, sync |
| [ui/FEATURE_MATRIX.md](ui/FEATURE_MATRIX.md) | MVP vs Phase 2+ checklist |
| [ui/VIEW_DATA_MAPPING.md](ui/VIEW_DATA_MAPPING.md) | UI section ↔ field ↔ source mappings |
| [ui/COLOR_TOKENS.md](ui/COLOR_TOKENS.md) | Normative sketch color tokens |
| [ui/LOCALIZATION.md](ui/LOCALIZATION.md) | zh-CN / en catalog; host `locale`; lane `categoryKey` |
| [formats/INPUT_FORMATS.md](formats/INPUT_FORMATS.md) | Container hub + profiles |
| [formats/VIEW_DATA_REQUIREMENTS.md](formats/VIEW_DATA_REQUIREMENTS.md) | Per-view adapted inputs |
| [formats/ADAPTERS.md](formats/ADAPTERS.md) | Profile detect → adapt |
| [architecture/COMPONENTS.md](architecture/COMPONENTS.md) | Canonical models and Vue component catalog |
| [architecture/ARCHITECTURE.md](architecture/ARCHITECTURE.md) | Packaging, adapters, data flow |

## Design sketches

PNG mockups live under [`ui/source/v930/`](ui/source/v930/). Component crops live next to Vue code under `src/ui/{Component}/visual/`. Hierarchy: [`ui/DESIGN_INDEX.md`](ui/DESIGN_INDEX.md).

UCD visual-review ledger (English): [`ui/review/UI_REVIEW_FINDINGS.md`](ui/review/UI_REVIEW_FINDINGS.md).

Design frames covering former changelog deltas (度量模式, Cube/Vector MIX toggle, compute/memory detail tabs, topology): [`ui/source/v930/`](ui/source/v930/) — see [`ui/DESIGN_INDEX.md`](ui/DESIGN_INDEX.md) and delivery [roadmap](process/roadmap/).

## Research archive

See [archive/README.md](archive/README.md). Key entries:

| Doc | Role |
|-----|------|
| [archive/research/SWIMLANE_WEBVIEW_REUSE_REPORT.md](archive/research/SWIMLANE_WEBVIEW_REUSE_REPORT.md) | Original PyPTO reuse study (Russian). Superseded packaging conclusion: Vue library, not HTML webview. |
| [archive/research/SWIMLANE_IMPLEMENTATIONS.md](archive/research/SWIMLANE_IMPLEMENTATIONS.md) | Canvas vs WebGL comparison |

## Related repositories (local)

| Repo | Role |
|------|------|
| `mstt` | Primary host — OP DevTools; today embeds msinsight for `.bin`/`.json` |
| `msinsight` | Legacy MindStudio Insight viewer |
| `pypto-tools` | UX reference and optional copy-paste source for swimlane algorithms |
| `sudu-editor` (`pp/swimlane-shader`) | WebGL coverage-AA technique reference (not a dependency) |
