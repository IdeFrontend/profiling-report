# Profiling Report — Documentation Index

English documentation and specifications for the reusable Vue profiling-report library.

## Reading order

1. **[context/PROJECT_GOALS.md](context/PROJECT_GOALS.md)** — why this project exists, consumers, MVP vs later, success criteria
2. **[context/DOMAIN_AND_USERS.md](context/DOMAIN_AND_USERS.md)** — OP developers, pain points, glossary, link to UX scenarios
3. **[context/MARKET_AND_COMPETITORS.md](context/MARKET_AND_COMPETITORS.md)** — NVIDIA Nsight analogues, competitors, market frame
4. **[context/OPEN_QUESTIONS.md](context/OPEN_QUESTIONS.md)** — Product decisions and remaining blockers
5. **[context/INTERIM_DECISIONS.md](context/INTERIM_DECISIONS.md)** — engineering defaults that unblock MVP coding (not Product-final)
6. **[process/DEVELOPMENT.md](process/DEVELOPMENT.md)** — top-down workflow: docs → specs → tests → code
7. **[process/TESTING.md](process/TESTING.md)** — Vitest / Playwright pyramid, fixtures, matrix → test ids
8. **[process/DEFINITION_OF_READY.md](process/DEFINITION_OF_READY.md)** — checklist before implementing a slice
9. **[specs/formats/FORMATS_COMPARISON.md](specs/formats/FORMATS_COMPARISON.md)** — semantic data comparison: Insight operator vs `.rep` vs PyPTO
10. **[specs/formats/REP_FORMAT.md](specs/formats/REP_FORMAT.md)** — CANN `.rep` / `.ncrep` container layout
11. **[specs/formats/METRICS_AND_TRACE.md](specs/formats/METRICS_AND_TRACE.md)** — embedded CSVs and `trace.json`
12. **[specs/formats/VIEW_DATA_REQUIREMENTS.md](specs/formats/VIEW_DATA_REQUIREMENTS.md)** — required inputs per chart/view; hide-if-missing rules
13. **[specs/ui/UI_OVERVIEW.md](specs/ui/UI_OVERVIEW.md)** — layout regions mapped to design sketches
14. **[specs/ui/COLOR_TOKENS.md](specs/ui/COLOR_TOKENS.md)** — normative colors from sketches
15. **[specs/ui/UX_SPEC.md](specs/ui/UX_SPEC.md)** — complete UX: scenarios, static vs interactive, sync model
16. **[specs/ui/FEATURE_MATRIX.md](specs/ui/FEATURE_MATRIX.md)** — MVP vs Phase 2+ feature list
17. **[specs/ui/INTERACTIONS.md](specs/ui/INTERACTIONS.md)** — hover, selection, multiselect, menus
18. **[specs/architecture/ARCHITECTURE.md](specs/architecture/ARCHITECTURE.md)** — Vue library: shared UI + format adapters, modules, data flow
19. **[specs/architecture/COMPONENTS.md](specs/architecture/COMPONENTS.md)** — reusable models, adapters, renderer, Vue component catalog
20. **[specs/architecture/MSTT_INTEGRATION.md](specs/architecture/MSTT_INTEGRATION.md)** — how MSTT opens `.rep` / `.json` beside Insight
21. **[research/SWIMLANE_IMPLEMENTATIONS.md](research/SWIMLANE_IMPLEMENTATIONS.md)** — PyPTO Canvas vs Sudu WebGL vs hybrid

## Process

| Doc | Role |
|-----|------|
| [context/PROJECT_GOALS.md](context/PROJECT_GOALS.md) | Goals, non-goals, consumers, success criteria |
| [context/DOMAIN_AND_USERS.md](context/DOMAIN_AND_USERS.md) | Domain users, pain points, glossary → UX |
| [context/MARKET_AND_COMPETITORS.md](context/MARKET_AND_COMPETITORS.md) | NVIDIA Nsight analogues and competitor landscape |
| [context/OPEN_QUESTIONS.md](context/OPEN_QUESTIONS.md) | P0–P2 blockers; resolution log |
| [context/INTERIM_DECISIONS.md](context/INTERIM_DECISIONS.md) | Interim engineering defaults for MVP coding |
| [context/PACKAGING_SUGGESTIONS.md](context/PACKAGING_SUGGESTIONS.md) | Q16–Q19 suggestions (interim until Product confirms) |
| [process/DEVELOPMENT.md](process/DEVELOPMENT.md) | Spec-driven TDD workflow, slice order, Definition of Done |
| [process/TESTING.md](process/TESTING.md) | Unit / component / e2e stack and fixture rules |
| [process/DEFINITION_OF_READY.md](process/DEFINITION_OF_READY.md) | Pre-coding checklist per slice |

## Specs (quick links)

| Doc | Role |
|-----|------|
| [specs/ui/UX_SPEC.md](specs/ui/UX_SPEC.md) | Scenarios S1–S9, static vs interactive, sync |
| [specs/ui/FEATURE_MATRIX.md](specs/ui/FEATURE_MATRIX.md) | MVP vs Phase 2+ checklist |
| [specs/ui/COLOR_TOKENS.md](specs/ui/COLOR_TOKENS.md) | Normative sketch color tokens |
| [specs/formats/VIEW_DATA_REQUIREMENTS.md](specs/formats/VIEW_DATA_REQUIREMENTS.md) | Per-view required inputs |
| [specs/architecture/COMPONENTS.md](specs/architecture/COMPONENTS.md) | Canonical models and Vue component catalog |
| [specs/architecture/ARCHITECTURE.md](specs/architecture/ARCHITECTURE.md) | Packaging, adapters, data flow |

## Design sketches

PNG mockups live under [`specs/ui/`](specs/ui/). Written UI specs reference them by filename.

## Research archive

| Doc | Role |
|-----|------|
| [research/SWIMLANE_WEBVIEW_REUSE_REPORT.md](research/SWIMLANE_WEBVIEW_REUSE_REPORT.md) | Original PyPTO reuse study (Russian). Conclusions superseded in English by architecture + swimlane comparison docs — packaging is a **Vue library**, not an HTML webview bundle. |
| [research/SWIMLANE_IMPLEMENTATIONS.md](research/SWIMLANE_IMPLEMENTATIONS.md) | Current English comparison and technical recommendation |

## Related repositories (local)

| Repo | Role |
|------|------|
| `mstt` | Primary host — OP DevTools; today embeds msinsight for `.bin`/`.json` |
| `msinsight` | Legacy MindStudio Insight viewer |
| `pypto-tools` | UX reference and optional copy-paste source for swimlane algorithms |
| `sudu-editor` (`pp/swimlane-shader`) | WebGL coverage-AA technique reference (not a dependency) |
