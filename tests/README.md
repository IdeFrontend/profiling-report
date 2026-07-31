# Test catalog

Maps product specs and interim decisions to stable **test ids**. See [docs/process/TESTING.md](../docs/process/TESTING.md) and [INTERIM_DECISIONS.md](../docs/context/INTERIM_DECISIONS.md).

## Scaffold (Milestone 1 — green)

| Id | Layer | File | Status |
|----|-------|------|--------|
| PR-SCAFFOLD-001 | unit | `tests/unit/scaffold.spec.ts` | green |
| PR-SCAFFOLD-002 | unit | `tests/unit/scaffold.spec.ts` | green (`parseRep` throws until parse slice) |
| PR-SCAFFOLD-003 | component | `tests/component/ProfilingReport.spec.ts` | green |
| PR-SCAFFOLD-004 | e2e | `tests/e2e/playground.spec.ts` | green |

## Feature TDD (Milestone 2 — expected RED until implemented)

| Id | Layer | File | Spec / interim |
|----|-------|------|----------------|
| PR-FMT-001 | unit | `tests/unit/parseRep.spec.ts` | REP_FORMAT |
| PR-FMT-002 | unit | `tests/unit/parseRep.spec.ts` | REP_FORMAT, I-Q4 |
| PR-VM-001 | unit | `tests/unit/viewModels.spec.ts` | I-Q6a |
| PR-VM-002 | unit | `tests/unit/viewModels.spec.ts` | I-Q6b |
| PR-VM-003 | unit | `tests/unit/viewModels.spec.ts` | I-Q5+, Q5 |
| PR-SWIM-001 | unit | `tests/unit/swimlaneModel.spec.ts` | COMPONENTS |
| PR-UI-001 | component | `tests/component/ProfilingReport.feature.spec.ts` | UX S1 |
| PR-UI-002 | component | `tests/component/ProfilingReport.feature.spec.ts` | INTERACTIONS |
| PR-UI-003 | component | `tests/component/ProfilingReport.feature.spec.ts` | Q3, VIEW_DATA_REQUIREMENTS |
| PR-E2E-001 | e2e | `tests/e2e/feature.spec.ts` | UX S1, I-Q4 |
| PR-E2E-002 | e2e | `tests/e2e/feature.spec.ts` | UX S3 |
| PR-E2E-003 | e2e | `tests/e2e/feature.spec.ts` | UX S3 |

**CI note:** Feature tests fail by design until the matching implementation slices land (parse → view-models → swimlane → UI). Scaffold smokes stay green. Prefer implementing slices to green rather than skipping these ids.

Put the id in the test title, e.g. `it('PR-E2E-002: hover shows tooltip', …)`.
