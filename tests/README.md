# Test catalog

Maps product specs and interim decisions to stable **test ids**. See [docs/process/TESTING.md](../docs/process/TESTING.md) and [INTERIM_DECISIONS.md](../docs/context/INTERIM_DECISIONS.md).

## Scaffold (Milestone 1 — green)

| Id | Layer | File | Status |
|----|-------|------|--------|
| PR-SCAFFOLD-001 | unit | `tests/unit/scaffold.spec.ts` | green |
| PR-SCAFFOLD-002 | unit | `tests/unit/scaffold.spec.ts` | green |
| PR-SCAFFOLD-003 | component | `tests/component/ProfilingReport.spec.ts` | green |
| PR-SCAFFOLD-004 | e2e | `tests/e2e/playground.spec.ts` | green |

## Feature (Milestone 2+ — green)

| Id | Layer | File | Spec / interim |
|----|-------|------|----------------|
| PR-FMT-001 | unit | `tests/unit/parseRep.spec.ts` | REP_FORMAT |
| PR-FMT-002 | unit | `tests/unit/parseRep.spec.ts` | REP_FORMAT, I-Q4 |
| PR-VM-001 | unit | `tests/unit/viewModels.spec.ts` | I-Q6a |
| PR-VM-002 | unit | `tests/unit/viewModels.spec.ts` | I-Q6b |
| PR-VM-003 | unit | `tests/unit/viewModels.spec.ts` | I-Q5+, Q5 |
| PR-SWIM-001 | unit | `tests/unit/swimlaneModel.spec.ts` | COMPONENTS |
| PR-TIME-001 | unit | `tests/unit/formatTime.spec.ts` | I-Q14 |
| PR-VIEW-001..003 | unit | `tests/unit/viewState.spec.ts` | INTERACTIONS, COMPONENTS |
| PR-RENDER-001..002 | unit | `tests/unit/canvasRenderer.spec.ts` | SwimlaneRenderer |
| PR-JSON-001..002 | unit | `tests/unit/loadReportSource.spec.ts` | Q15 standalone CTEF |
| PR-UI-001 | component | `tests/component/ProfilingReport.feature.spec.ts` | UX S1 |
| PR-UI-002 | component | `tests/component/ProfilingReport.feature.spec.ts` | INTERACTIONS |
| PR-UI-003 | component | `tests/component/ProfilingReport.feature.spec.ts` | Q3, VIEW_DATA_REQUIREMENTS |
| PR-UI-004 | component | `tests/component/ProfilingReport.feature.spec.ts` | UX S2 zoom-to-fit |
| PR-UI-005 | component | `tests/component/ProfilingReport.feature.spec.ts` | Search |
| PR-UI-006 | component | `tests/component/ProfilingReport.feature.spec.ts` | Q15 hide aside |
| PR-E2E-001 | e2e | `tests/e2e/feature.spec.ts` | UX S1, I-Q4 |
| PR-E2E-002 | e2e | `tests/e2e/feature.spec.ts` | UX S3 |
| PR-E2E-003 | e2e | `tests/e2e/feature.spec.ts` | UX S3 |
| PR-E2E-004 | e2e | `tests/e2e/feature.spec.ts` | UX S2 |
| PR-E2E-005 | e2e | `tests/e2e/feature.spec.ts` | Q15 |

Put the id in the test title, e.g. `it('PR-E2E-002: hover shows tooltip', …)`.
