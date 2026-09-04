# Definition of Ready

Checklist before writing implementation code for a work slice. See [DEVELOPMENT.md](DEVELOPMENT.md) for overall workflow and [TESTING.md](TESTING.md) for how tests encode the specs.

A slice is **Ready** only when every applicable item below is checked.

## 1. Spec coverage

- [ ] Goal alignment: the slice supports an MVP (or explicitly Phase 2) item in [PROJECT_GOALS](../context/PROJECT_GOALS.md) / [FEATURE_MATRIX](../ui/FEATURE_MATRIX.md)
- [ ] Format behavior (if any) is documented in [REP_FORMAT](../formats/REP_FORMAT.md) and/or [METRICS_AND_TRACE](../formats/METRICS_AND_TRACE.md)
- [ ] UI/interaction behavior (if any) is documented in [UI_OVERVIEW](../ui/UI_OVERVIEW.md), [UX_SPEC](../ui/UX_SPEC.md), and/or [INTERACTIONS](../ui/INTERACTIONS.md)
- [ ] Public API / component names are consistent with [ARCHITECTURE](../architecture/ARCHITECTURE.md) and [COMPONENTS](../architecture/COMPONENTS.md)
- [ ] If the slice changes a spec, the spec PR section is drafted **before** coding

## 2. Acceptance tests sketched

- [ ] Test ids assigned (see [TESTING.md](TESTING.md) id scheme)
- [ ] Layer chosen for each acceptance: unit / component / e2e
- [ ] Failing tests can be written first (or are already drafted as `it.fails` / `test.todo` with clear titles)
- [ ] MVP matrix rows touched by this slice are listed with their test ids

## 3. Fixtures and data

- [ ] Primary fixture identified (`data/out.rep` and/or a synthetic fixture)
- [ ] Expected outcomes known (e.g. file count in container, lane names, summary fields)
- [ ] Gaps vs sketches acknowledged — use interim fixture rules ([decisions/interim/](../context/decisions/interim/) DATA-31a); no silent inventing of multi-core data the fixture lacks
- [ ] If the slice depends on an **Interim** decision, the interim id is named in the PR (and tests assert that interim)

## 4. Scope and boundaries

- [ ] Slice is vertical and small enough for one PR when possible
- [ ] Out of scope called out (especially MSTT host work → separate repo/PR)
- [ ] No new runtime dependency on pypto, sudu-editor, or msinsight

## 5. Tooling prerequisite

- [ ] For the **first** feature slice: test infrastructure milestone is already merged (Vitest + Playwright + playground), per DEVELOPMENT.md “Next engineering milestone”
- [ ] For later slices: CI path for the chosen test layers exists

## Template (paste into PR / issue)

```markdown
## Slice
- Name:
- Matrix rows (M/P2):
- Spec links:

## Test plan
| Test id | Layer | Asserts |
|---------|-------|---------|
| PR-…    | unit  | …       |

## Fixtures
-

## Out of scope
-
```

If any Ready item is blocked, stop and update specs or tooling first — do not start feature implementation.
