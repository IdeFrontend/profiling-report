# Profiling Report — Documentation Index

English documentation for the reusable Vue profiling-report library. Formal behavioral contracts live in root [`specs/`](../specs/); this tree holds descriptive system/UX/format docs and design assets.

## Reading order

1. **[context/PROJECT_GOALS.md](context/PROJECT_GOALS.md)** — why this project exists, consumers, MVP vs later, success criteria
2. **[usage/USAGE.md](usage/USAGE.md)** — how to consume the library (props/emits, theming, i18n, capabilities, data flow)
2. **[context/DOMAIN_AND_USERS.md](context/DOMAIN_AND_USERS.md)** — OP developers, pain points, glossary, link to UX scenarios
3. **[context/MARKET_AND_COMPETITORS.md](context/MARKET_AND_COMPETITORS.md)** — NVIDIA Nsight analogues, competitors, market frame
4. **[context/OPEN_QUESTIONS.md](context/OPEN_QUESTIONS.md)** — Product decisions and remaining blockers
5. **[context/INTERIM_DECISIONS.md](context/INTERIM_DECISIONS.md)** — engineering defaults that unblock MVP coding (not Product-final)
6. **[process/DEVELOPMENT.md](process/DEVELOPMENT.md)** — top-down workflow: docs → specs → tests → code
7. **[process/roadmap/](process/roadmap/)** — delivery milestones to full UI (dates, tasks, blockers)
7. **[process/PROJECT_STRUCTURE.md](process/PROJECT_STRUCTURE.md)** — canonical project layout: spec locations, per-component folders, test ID conventions, traceability
8. **[process/TESTING.md](process/TESTING.md)** — Vitest / Playwright pyramid, fixtures, matrix → test ids
9. **[process/DEFINITION_OF_READY.md](process/DEFINITION_OF_READY.md)** — checklist before implementing a slice
10. **[formats/FORMATS_COMPARISON.md](formats/FORMATS_COMPARISON.md)** — semantic data comparison: Insight operator vs `.rep` vs PyPTO
11. **[formats/REP_FORMAT.md](formats/REP_FORMAT.md)** — CANN `.rep` / `.ncrep` container layout
12. **[formats/METRICS_AND_TRACE.md](formats/METRICS_AND_TRACE.md)** — embedded CSVs and `trace.json`
13. **[formats/VIEW_DATA_REQUIREMENTS.md](formats/VIEW_DATA_REQUIREMENTS.md)** — required inputs per chart/view; hide-if-missing rules
14. **[ui/DESIGN_INDEX.md](ui/DESIGN_INDEX.md)** — design image hierarchy (sources → screens → component crops)
15. **[ui/UI_OVERVIEW.md](ui/UI_OVERVIEW.md)** — layout regions mapped to design sketches
16. **[ui/VIEW_DATA_MAPPING.md](ui/VIEW_DATA_MAPPING.md)** — UI section ↔ field ↔ source mappings
17. **[ui/COLOR_TOKENS.md](ui/COLOR_TOKENS.md)** — normative colors from sketches
18. **[ui/UX_SPEC.md](ui/UX_SPEC.md)** — complete UX: scenarios, static vs interactive, sync model
19. **[ui/FEATURE_MATRIX.md](ui/FEATURE_MATRIX.md)** — MVP vs Phase 2+ feature list
20. **[ui/INTERACTIONS.md](ui/INTERACTIONS.md)** — hover, selection, multiselect, menus
21. **[architecture/ARCHITECTURE.md](architecture/ARCHITECTURE.md)** — Vue library: shared UI + format adapters, modules, data flow
22. **[architecture/COMPONENTS.md](architecture/COMPONENTS.md)** — reusable models, adapters, renderer, Vue component catalog
23. **[architecture/MSTT_INTEGRATION.md](architecture/MSTT_INTEGRATION.md)** — how MSTT opens `.rep` / `.json` beside Insight
24. **[archive/research/SWIMLANE_IMPLEMENTATIONS.md](archive/research/SWIMLANE_IMPLEMENTATIONS.md)** — PyPTO Canvas vs Sudu WebGL vs hybrid

## Process

| Doc | Role |
|-----|------|
| [context/PROJECT_GOALS.md](context/PROJECT_GOALS.md) | Goals, non-goals, consumers, success criteria |
| [usage/USAGE.md](usage/USAGE.md) | Consumer usage guide — public API, `ProfilingReport` props/emits, theming, i18n, capabilities |
| [context/DOMAIN_AND_USERS.md](context/DOMAIN_AND_USERS.md) | Domain users, pain points, glossary → UX |
| [context/MARKET_AND_COMPETITORS.md](context/MARKET_AND_COMPETITORS.md) | NVIDIA Nsight analogues and competitor landscape |
| [context/OPEN_QUESTIONS.md](context/OPEN_QUESTIONS.md) | P0–P2 blockers; resolution log |
| [context/INTERIM_DECISIONS.md](context/INTERIM_DECISIONS.md) | Interim engineering defaults for MVP coding |
| [context/PACKAGING_SUGGESTIONS.md](context/PACKAGING_SUGGESTIONS.md) | Q16–Q19 suggestions (interim until Product confirms) |
| [process/DEVELOPMENT.md](process/DEVELOPMENT.md) | Spec-driven TDD workflow, slice order, Definition of Done |
| [process/roadmap/](process/roadmap/) | Delivery milestones M1–M3 (dates, swimlane vs other views, tasks, blockers) |
| [process/TESTING.md](process/TESTING.md) | Unit / component / e2e stack and fixture rules |
| [process/DEFINITION_OF_READY.md](process/DEFINITION_OF_READY.md) | Pre-coding checklist per slice |

Executable test id catalog (after scaffold): [`tests/README.md`](../tests/README.md) (deprecated in favor of co-located component specs and [`specs/README.md`](../specs/README.md)).

## System docs (quick links)

| Doc | Role |
|-----|------|
| [ui/UX_SPEC.md](ui/UX_SPEC.md) | Scenarios S1–S9, static vs interactive, sync |
| [ui/FEATURE_MATRIX.md](ui/FEATURE_MATRIX.md) | MVP vs Phase 2+ checklist |
| [ui/VIEW_DATA_MAPPING.md](ui/VIEW_DATA_MAPPING.md) | UI section ↔ field ↔ source mappings |
| [ui/COLOR_TOKENS.md](ui/COLOR_TOKENS.md) | Normative sketch color tokens |
| [formats/VIEW_DATA_REQUIREMENTS.md](formats/VIEW_DATA_REQUIREMENTS.md) | Per-view required inputs |
| [architecture/COMPONENTS.md](architecture/COMPONENTS.md) | Canonical models and Vue component catalog |
| [architecture/ARCHITECTURE.md](architecture/ARCHITECTURE.md) | Packaging, adapters, data flow |

## Design sketches

PNG mockups live under [`ui/source/v930/`](ui/source/v930/). Component crops live next to Vue code under `src/ui/{Component}/visual/`. Hierarchy: [`ui/DESIGN_INDEX.md`](ui/DESIGN_INDEX.md).

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
