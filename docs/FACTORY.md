# Factory operator page

Normative detail: [process/AI_FACTORY.md](process/AI_FACTORY.md). Lifecycle owner:
[process/DEVELOPMENT.md](process/DEVELOPMENT.md). DoR: [process/DEFINITION_OF_READY.md](process/DEFINITION_OF_READY.md).

## Order (one role, isolated)

1. Spec Author (root + component `*.spec.md`).
2. Architect design gate.
3. Test Author — red tests (assertion-mismatch, not missing modules) + `stage-red`.
4. Spec Author coverage review (PR comment matrix). Do not start Developer until `COVERAGE_PASS`.
5. Developer — implement the slice (new behaviour); never edit tests/specs.
6. Architect structure audit.
7. Consistency — docs ↔ specs ↔ tests ↔ code (PR comment).
8. Performance — `npm run bench:perf` vs baseline (PR comment).
9. Reviewer — GitHub PR review.
10. **Fixer** (only if Reviewer fails on impl) — fix listed review findings only; no new features → back to Reviewer.
11. Human merge when `hitl` after `REVIEW_PASS`.

You do **not** paste the next role’s prompt. After kickoff, watch labels. A fresh cloud agent reads
`.agents/skills/<role>/SKILL.md` and `.cursor/factory-automations/<role>.md`.

## Kickoff (you, once per slice)

Branch `slice/<slice-id>`. Open a **draft** PR to `master`. Do not enable Autopilot.

1. Tick Definition of Ready.
2. Comment exactly:

```
/factory start slice=<slice-id> role=spec-author
```

Or apply label `start`, then the first `awaiting-*`.

3. Leave. Return when the PR has `hitl`.

## HITL (you, only then)

Reply with **exactly** one of:

- `Approved. Proceed to code.` — resume Developer after contract HITL.
- `Approved. Continue to slice N.` — permission for the **next** slice branch only.
- `Approved. Accept perf baseline.` — allow baseline bump after a documented tradeoff.

## Labels

| Label | Meaning |
|-------|---------|
| `start` | Kickoff latch |
| `awaiting-spec` … `awaiting-review`, `awaiting-fixer` | Next isolated role |
| `stage-red` | `red-stage` check must pass on assertion-mismatch red |
| `stage-implement` | Full CI must be green |
| `hitl` | Stopped for you |
| `done` | After human merge |

## Inter-role invocation

Back-channel uses the same PR handoff comment + label bus (never freeform `@role` chat).

| From | May invoke | When |
|------|------------|------|
| Test Author | Spec Author | Ambiguous / contradictory / untestable requirements |
| Test Author | Architect | Need clearer module boundaries |
| Developer | Test Author | Tests wrong or incomplete (Dev must not edit tests) |
| Developer | Spec / Architect | Spec impossible or layering blocked |
| Spec (coverage) | Test Author | Weak coverage |
| Reviewer | **Fixer** | Impl / code-quality findings only |
| Reviewer | Test / Spec / Architect / HITL | Non-impl findings |
| Fixer | Reviewer | Findings addressed (`FIXED`) |
| Consistency / Perf | Owning role | Per finding class in AI_FACTORY |

**Re-entry:** test change after coverage → Spec coverage again. Spec boundary change → Architect
design again. Max **2** back-hops per edge; third → `hitl`.

## Automations

Prompt copies: [`.cursor/factory-automations/`](../.cursor/factory-automations/). Save each in Cursor
Automations (label trigger). If the UI copy drifts, fix the UI or stop using Automations.

## Handoff bus

Structured PR comments (`<!-- factory-handoff -->` + JSON). Actions parses each comment and syncs
labels. There is no committed handoff file under `docs/reports/`. Humans also read the same comments
and GitHub reviews for findings.
