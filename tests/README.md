# Test catalog

Maps product specs and interim decisions to stable **test ids**. See [docs/process/TESTING.md](../docs/process/TESTING.md) and [INTERIM_DECISIONS.md](../docs/context/INTERIM_DECISIONS.md).

## Scaffold (Milestone 1 — green)

| Id | Layer | File | Status |
|----|-------|------|--------|
| PR-SCAFFOLD-001 | unit | `tests/unit/scaffold.spec.ts` | green |
| PR-SCAFFOLD-002 | unit | `tests/unit/scaffold.spec.ts` | green (`parseRep` throws) |
| PR-SCAFFOLD-003 | component | `tests/component/ProfilingReport.spec.ts` | green |
| PR-SCAFFOLD-004 | e2e | `tests/e2e/playground.spec.ts` | green |

## Feature TDD backlog (Milestone 2+ — write failing, then implement)

| Id | Layer | Asserts | Spec / interim |
|----|-------|---------|----------------|
| PR-FMT-001 | unit | Parse `.rep` header / file table | REP_FORMAT |
| PR-FMT-002 | unit | Embed list matches `data/out.rep` | REP_FORMAT, I-Q4 |
| PR-VM-001 | unit | OpBasicInfo → thin summary (name/type/duration) | I-Q6a, VIEW_DATA_REQUIREMENTS |
| PR-VM-002 | unit | PipeUtilization → PIPE bars, mean non-`NA` | I-Q6b |
| PR-VM-003 | unit | `overviewSeries` empty / not invented from ratios | I-Q5+, Q5 |
| PR-SWIM-001 | unit | `trace.json` → SwimlaneModel | COMPONENTS |
| PR-UI-001 | component | ProfilingReport mounts with fixture bytes | COMPONENTS, UX S1 |
| PR-UI-002 | component | select emits detail payload | INTERACTIONS |
| PR-UI-003 | component | Missing optional panels hidden | Q3, VIEW_DATA_REQUIREMENTS |
| PR-E2E-001 | e2e | Playground loads `out.rep` | UX S1, I-Q4 |
| PR-E2E-002 | e2e | Hover tooltip | UX S3 |
| PR-E2E-003 | e2e | Click selects event | UX S3 |

Put the id in the test title, e.g. `it('PR-E2E-002: hover shows tooltip', …)`.
