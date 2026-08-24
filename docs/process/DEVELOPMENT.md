# Development Process

How we build profiling-report: **docs → specs → tests → code**.

## Principles

1. **Specs before code.** Product behavior lives in spec files — root-level [`specs/`](../../specs/) for core and architecture, co-located `.spec.md` files per Vue component. See [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) for the canonical layout. Code implements the specs; it does not invent undocumented behavior.
2. **Tests before (or with) implementation.** For each work slice, write failing automated tests that encode the relevant specs, then implement until green, then refactor.
3. **Outside-in slices.** Prefer vertical slices (parse → model → UI for one capability) over building an entire layer with nothing wired.
4. **Library first, host second.** Prove the Vue library in this repo (unit + component + playground e2e). Wire MSTT after the library CI is green.
5. **English docs.** Process and specs stay in English.

This is **spec-driven TDD** with Vitest and Playwright. We do **not** use Gherkin/Cucumber in v1.

## Workflow

```text
docs (goals)
  → specs (formats / UI / architecture)
      → Definition of Ready for a slice
          → failing tests (unit / component / e2e as needed)
              → minimal implementation until green
                  → refactor
                      → Definition of Done
```

| Stage | Artifacts | Owner check |
|-------|-----------|-------------|
| Docs | [`PROJECT_GOALS.md`](../context/PROJECT_GOALS.md) | Goals and non-goals still accurate |
| Specs | Root [`specs/`](../../specs/) + co-located [`*.spec.md`](../../specs/) per [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) | Feature listed in [FEATURE_MATRIX](../ui/FEATURE_MATRIX.md); format/UI details exist in [`docs/`](../) |
| Ready | [DEFINITION_OF_READY.md](DEFINITION_OF_READY.md) | Checklist complete before coding |
| Tests | See [TESTING.md](TESTING.md) | Failing tests map to matrix / spec IDs |
| Code | `src/`, `playground/` | Minimal change to pass tests |
| Done | PR + CI | DoD below |

## Definition of Done (slice)

A slice is done when all of the following hold:

- [ ] Specs updated if behavior changed (never “fix only in code”)
- [ ] Automated tests for the slice are green (unit and/or component and/or e2e as required by [TESTING.md](TESTING.md))
- [ ] Every touched **MVP** row in [FEATURE_MATRIX](../ui/FEATURE_MATRIX.md) has at least one test id referenced in the PR description
- [ ] No new public API without types exported from the library entry
- [ ] Playground still loads `data/out.rep` when the slice touches UI or parse
- [ ] CI (`lint` → `vitest` → `playwright`) green on the PR

## Recommended work slice order

Implement in this order unless a blocking dependency forces a temporary exception (document the exception in the PR):

1. **Tooling scaffold** (next milestone after these process docs) — Vite library package, Vitest, Playwright, playground app, empty failing smoke tests. **No feature code until this is green.**
2. **Core parse** — [REP_FORMAT](../formats/REP_FORMAT.md) + golden [`data/out.rep`](../../data/out.rep)
3. **View-models** — [METRICS_AND_TRACE](../formats/METRICS_AND_TRACE.md) (PIPE bars, report summary)
4. **Swimlane model** — trace → `SwimlaneModel` ([ARCHITECTURE](../architecture/ARCHITECTURE.md))
5. **UI shell** — panels + interactions ([UI_OVERVIEW](../ui/UI_OVERVIEW.md), [UX_SPEC](../ui/UX_SPEC.md), [INTERACTIONS](../ui/INTERACTIONS.md), [COMPONENTS](../architecture/COMPONENTS.md))
6. **Renderer** — Canvas behind `SwimlaneRenderer`; keep hit-test/view contracts so WebGL can swap later ([SWIMLANE_IMPLEMENTATIONS](../archive/research/SWIMLANE_IMPLEMENTATIONS.md))
7. **MSTT host** — separate PR in `mstt` per [MSTT_INTEGRATION](../architecture/MSTT_INTEGRATION.md)

## Target repo layout

```text
specs/            # root-level behavioral specs (core + architecture)
src/              # Vue library (adapters / domain / swimlane / ui with co-located *.spec.md)
playground/       # Vite app mounting ProfilingReport (Playwright target)
tests/
  unit/
  component/
  e2e/
  fixtures/       # optional snapshots; golden binaries live under data/
docs/             # goals, process (this tree)
data/             # canonical sample .rep / .trace.json + pack/unpack scripts
```

Full canonical layout: [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md).

## When to update specs

Update specs **in the same PR** as code when you:

- Discover sample data cannot support a documented MVP claim (narrow the matrix or note a fixture gap)
- Change public props/emits or the `.rep` contract
- Add or defer a feature (move M ↔ P2 in FEATURE_MATRIX with a one-line reason)
- **Resolve an open question** (see below)

Do not leave “temporary” undocumented behavior in main.

## Resolving open questions

Open lists are for **unanswered** items only: [OPEN_QUESTIONS.md](../context/OPEN_QUESTIONS.md), [HQ_OPEN_QUESTIONS.md](../context/HQ_OPEN_QUESTIONS.md).

When Product answers a question:

1. **Convert to a spec requirement** in the owning docs/specs (INTERACTIONS, UX_SPEC, FEATURE_MATRIX, COMPONENTS, VIEW_DATA_REQUIREMENTS, format docs, co-located `*.spec.md`, etc.). Write normative product truth — not “open until Q*” / “blocked on Q*”.
2. **Remove** the item from the open list(s) in the **same change**. For HQ crops, drop the matching `docs/context/visual/hq` manifest entry and PNG. Optional: one line in the OPEN_QUESTIONS **resolution log** that points at the specs (not at HQ).
3. **Supersede interim guesses** — delete or strike the matching [INTERIM_DECISIONS.md](../context/INTERIM_DECISIONS.md) row and scrub “until Q*” wording elsewhere.
4. **Tests** assert the decided behavior when the feature already exists; otherwise the new spec text is the DoR input for the next slice.

Do **not** leave a **Resolved** row parked on an open-questions table. Agents: see `.cursor/rules/resolve-open-questions.mdc`.

## Copy-paste policy

- Allowed: algorithms and UX ideas from PyPTO swimGraph; Sudu coverage-AA shader math reimplemented in TypeScript.
- Not allowed as dependencies: pypto_toolkit runtime, sudu-editor / TeaVM, MindStudio Insight.
- Attribution: note non-trivial copied logic in the PR description; respect licenses (see research docs).

## Library engineering milestones (done)

**Milestone 1 (scaffold)** — green: Vite library, Vitest, Playwright, playground (`PR-SCAFFOLD-*`).

**Milestone 2 (parse → view-models → swimlane → UI shell)** — green on `master` (`PR-FMT-*` / `PR-VM-*` / `PR-SWIM-*` / `PR-UI-*` / `PR-E2E-*`).

**Milestone 3 (renderer + navigation)** — Canvas `SwimlaneRenderer`, view-state zoom/pan, toolbar (search / zoom / fit / toggle aside), I-Q14 time formatting (`PR-TIME-*` / `PR-VIEW-*` / `PR-RENDER-*` / `PR-UI-004+` / `PR-E2E-004`).

**Milestone 4 (trace JSON + MVP polish)** — standalone Chrome Trace open path (Q15), gutter util bars, time-unit control, i18n hooks, CSS tokens (`PR-JSON-*` / `PR-UI-006` / `PR-E2E-005`).

## Delivery milestones

**Delivery Milestone 1 (demo-data aside modes) — completed 2026-08-11.** All `out.rep` CSV embeds parsed and surfaced: Summary, PIPE with Cube|Vector toggle (changes.png #2), compute detail tabs (PipeUtilization / ArithmeticUtilization / ResourceConflictRatio, #3), memory tabs (L0 / L2Cache / L1 / UB) with block switcher and 查看全部 (#4). Full progress report: [M1_PROGRESS.md](roadmap/M1_PROGRESS.md).

**Next:** [Delivery Milestone 2](roadmap/milestone-2.md) — MSTT host + selection/deps + details + memory graph + roofline + timeline time-range measure, target **2026-08-25**. Then [M3](roadmap/milestone-3.md) (remaining full UI, **2026-09-15**).
