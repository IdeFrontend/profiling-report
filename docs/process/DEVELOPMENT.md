# Development Process

How we build profiling-report: **docs → specs → tests → code**.

## Principles

1. **Specs before code.** Product behavior lives under [`docs/specs/`](../specs/). Code implements the specs; it does not invent undocumented behavior.
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
| Specs | [`docs/specs/`](../specs/) | Feature listed in [FEATURE_MATRIX](../specs/ui/FEATURE_MATRIX.md); format/UI details exist |
| Ready | [DEFINITION_OF_READY.md](DEFINITION_OF_READY.md) | Checklist complete before coding |
| Tests | See [TESTING.md](TESTING.md) | Failing tests map to matrix / spec IDs |
| Code | `src/`, `playground/` | Minimal change to pass tests |
| Done | PR + CI | DoD below |

## Definition of Done (slice)

A slice is done when all of the following hold:

- [ ] Specs updated if behavior changed (never “fix only in code”)
- [ ] Automated tests for the slice are green (unit and/or component and/or e2e as required by [TESTING.md](TESTING.md))
- [ ] Every touched **MVP** row in [FEATURE_MATRIX](../specs/ui/FEATURE_MATRIX.md) has at least one test id referenced in the PR description
- [ ] No new public API without types exported from the library entry
- [ ] Playground still loads `data/out.rep` when the slice touches UI or parse
- [ ] CI (`lint` → `vitest` → `playwright`) green on the PR

## Recommended work slice order

Implement in this order unless a blocking dependency forces a temporary exception (document the exception in the PR):

1. **Tooling scaffold** (next milestone after these process docs) — Vite library package, Vitest, Playwright, playground app, empty failing smoke tests. **No feature code until this is green.**
2. **Core parse** — [REP_FORMAT](../specs/formats/REP_FORMAT.md) + golden [`data/out.rep`](../../data/out.rep)
3. **View-models** — [METRICS_AND_TRACE](../specs/formats/METRICS_AND_TRACE.md) (PIPE bars, report summary)
4. **Swimlane model** — trace → `SwimlaneModel` ([ARCHITECTURE](../specs/architecture/ARCHITECTURE.md))
5. **UI shell** — panels + interactions ([UI_OVERVIEW](../specs/ui/UI_OVERVIEW.md), [UX_SPEC](../specs/ui/UX_SPEC.md), [INTERACTIONS](../specs/ui/INTERACTIONS.md), [COMPONENTS](../specs/architecture/COMPONENTS.md))
6. **Renderer** — Canvas behind `SwimlaneRenderer`; keep hit-test/view contracts so WebGL can swap later ([SWIMLANE_IMPLEMENTATIONS](../research/SWIMLANE_IMPLEMENTATIONS.md))
7. **MSTT host** — separate PR in `mstt` per [MSTT_INTEGRATION](../specs/architecture/MSTT_INTEGRATION.md)

## Target repo layout (when implementation starts)

```text
src/              # Vue library (core / swimlane / ui)
playground/       # Vite app mounting ProfilingReport (Playwright target)
tests/
  unit/
  component/
  e2e/
  fixtures/       # golden snapshots; paths to data/out.rep
docs/             # goals, specs, process (this tree)
data/             # sample .rep + pack/unpack scripts
```

## When to update specs

Update specs **in the same PR** as code when you:

- Discover sample data cannot support a documented MVP claim (narrow the matrix or note a fixture gap)
- Change public props/emits or the `.rep` contract
- Add or defer a feature (move M ↔ P2 in FEATURE_MATRIX with a one-line reason)

Do not leave “temporary” undocumented behavior in main.

## Copy-paste policy

- Allowed: algorithms and UX ideas from PyPTO swimGraph; Sudu coverage-AA shader math reimplemented in TypeScript.
- Not allowed as dependencies: pypto_toolkit runtime, sudu-editor / TeaVM, MindStudio Insight.
- Attribution: note non-trivial copied logic in the PR description; respect licenses (see research docs).

## Next engineering milestone

MVP coding may start under [INTERIM_DECISIONS.md](../context/INTERIM_DECISIONS.md). First implementation step remains **test infrastructure**:

1. Scaffold package + Vite + Vue 3 + TypeScript (repo-root `src/` per interim Q16)
2. Vitest (+ Vue Test Utils) and Playwright
3. Playground that loads `data/out.rep` (I-Q4)
4. Placeholder failing tests (e.g. `parseRep` smoke, playground “loads report” e2e)

Feature implementation starts only when that scaffold is merged and CI runs the empty/failing suite successfully. Do not invent Product-final formulas for hidden summary tiles (I-Q6a).
