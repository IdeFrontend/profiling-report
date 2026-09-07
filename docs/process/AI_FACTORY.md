# AI Factory (development crew)

**Status:** Normative for process. Subordinate to [DEVELOPMENT.md](DEVELOPMENT.md), which owns the
lifecycle; this doc assigns *who* performs each stage.
**Operator page:** [FACTORY.md](../FACTORY.md)
**Prefix:** `FAC`

---

## 1. Design principle

**[FAC-001]** The role that writes tests MUST NOT write the implementation, and vice versa.

**[FAC-002]** Roles MUST be Cursor-native — skills, rules, and Automations — not a separate
orchestration runtime.

**[FAC-003]** Agents MUST NOT chat-handoff or `Agent.resume` across roles. Communication is
structured PR comments + PR labels (+ exact-match trusted human comments).

A single agent writing spec, tests, and code in one pass will write tests that agree with the code
it just wrote. Role separation is what makes the tests independent.

---

## 2. Roles

Happy path:

```text
Spec Author (author)
  → Architect (design)
    → Test Author
      → Spec Author (coverage)
        → Developer
          → Architect (structure)
            → Consistency
              → Performance
                → Reviewer
                  → Human (hitl / merge)
```

Review findings on implementation loop back through **Fixer** (not Developer):

```text
Reviewer --REVIEW_FAIL(impl)--> Fixer --FIXED--> Reviewer
```

| Role | Writes | Must not | Forward exit |
|------|--------|----------|--------------|
| Spec Author | `specs/`, `src/**/*.spec.md`, product docs under `docs/` | Feature impl, tests | `READY` → architect; `COVERAGE_PASS` → developer |
| Architect | `docs/architecture/**`, architecture notes; PR findings | Feature impl, tests | `ARCH_PASS` design → test-author; structure → consistency |
| Test Author | `tests/**`, co-located `src/**/*.spec.ts`, throw-only stubs | Feature impl, specs | `RED_PASS` → spec-author (coverage) + `stage-red` |
| Developer | Feature code under `src/`, `playground/` (new slice behaviour) | Specs, tests, architecture docs, goldens; **must not** act as review fixer | `GREEN` → architect (structure) + `stage-implement` |
| Fixer | Feature code under `src/`, `playground/` **only** to resolve open Reviewer findings | New functionality beyond those findings; specs; tests; architecture docs | `FIXED` → reviewer |
| Consistency | PR comment (findings + handoff block) only | Any product-tree fix | `CONSISTENCY_PASS` → performance |
| Performance | PR comment + baseline only after HITL unlock | Drive-by optimization | `PERF_PASS` → reviewer |
| Reviewer | GitHub PR review + handoff comment | Any fix | `REVIEW_PASS` → human; impl issues → **fixer** |
| Human | Kickoff, HITL unlocks, merge | — | `done` after merge |

**[FAC-004]** Spec Author and Test Author MAY write under `src/` for co-located `*.spec.md` /
`*.spec.ts` only. They MUST NOT change feature implementation.

**[FAC-005]** Developer MUST NOT edit specs or tests. Developer implements the slice; Fixer
addresses review findings.

**[FAC-017]** Fixer MUST ONLY change code to resolve Reviewer findings listed on the PR. Fixer
MUST NOT invent new product behaviour, expand scope, or “while I’m here” refactors unrelated to
those findings.

**[FAC-006]** Consistency, Performance, and Reviewer MUST NOT write narrative files under
`docs/reports/`. Findings and handoffs live on the PR.

**[FAC-007]** Do not enable Autopilot on factory PRs.

### Dual-wake phases

Handoff-comment `phase` disambiguates:

- Spec Author: `author` | `coverage` (label `awaiting-spec`)
- Architect: `design` | `structure` (label `awaiting-architect`)

---

## 3. Labels

No `factory/` prefix.

**Mutually exclusive stage (at most one):**
`start`, `awaiting-spec`, `awaiting-architect`, `awaiting-tests`, `awaiting-dev`,
`awaiting-fixer`, `awaiting-consistency`, `awaiting-perf`, `awaiting-review`, `hitl`, `done`

**Mode labels (may coexist):**
`stage-red` (named check `red-stage` must pass; CI skips default green tests),
`stage-implement` (full CI must be green before Consistency / Perf / Reviewer)

---

## 4. Trusted comments

Exact match only; everything else ignored as dispatcher input.

| Comment | Effect |
|---------|--------|
| `/factory start slice=<id> role=<spec-author\|test-author\|developer>` | First `awaiting-*`; remove `start` |
| `Approved. Proceed to code.` | Remove `hitl`, add `awaiting-dev` |
| `Approved. Continue to slice N.` | Permission for next slice branch only |
| `Approved. Accept perf baseline.` | Allow baseline bump after documented tradeoff |

---

## 5. Handoff bus (PR comments)

There is **no** committed handoff log under `docs/reports/`. Every role posts **one** PR comment
with a human summary and a machine block. Actions parse the block and sync labels.

Comment shape:

~~~markdown
### Factory · spec-author · READY

Wrote component specs for …

<!-- factory-handoff -->
```json
{
  "slice": "example-slice",
  "commit": "40-char-sha-or-unknown",
  "from_role": "spec-author",
  "to_role": "architect",
  "status": "READY",
  "phase": "author",
  "ids": ["PR-UI-001"],
  "reason": "",
  "developer_attempts": 0,
  "idempotency": "<commit>:<from_role>",
  "spike": false
}
```
~~~

Trusted human comments stay exact-match (`/factory start`, `Approved. …`). Role handoffs are
identified by `<!-- factory-handoff -->` + valid JSON — not freeform prose alone.

**[FAC-008]** `idempotency` MUST equal `<commit>:<from_role>`.

**[FAC-009]** Back-channel hops MUST include a non-empty `reason` (JSON field or `artifacts`
entry prefixed `reason:`).

Statuses: `READY | ARCH_PASS | ARCH_FAIL | CLARIFY | BLOCKED | RED_PASS | COVERAGE_PASS |
COVERAGE_FAIL | GREEN | FIXED | TEST_GAP | CONSISTENCY_PASS | CONSISTENCY_FAIL | PERF_PASS |
PERF_FAIL | REVIEW_PASS | REVIEW_FAIL | HITL`

---

## 6. Inter-role invocation (back-channel)

**[FAC-010]** Any hop uses a factory-handoff PR comment + labels. Freeform `@role` chat is not the bus.

Allowed matrix: see [FACTORY.md](../FACTORY.md) § Inter-role invocation (normative copy below).

| From | May invoke | When |
|------|------------|------|
| Test Author | Spec Author | Ambiguous / contradictory / untestable requirements |
| Test Author | Architect | Cannot place tests without clearer boundaries |
| Test Author | HITL | Product ambiguity Spec cannot invent |
| Spec Author (coverage) | Test Author | Weak / missing coverage |
| Spec Author (author) | Architect | Spec change implies structural redesign |
| Spec Author | HITL | Product decision needed |
| Developer | Test Author | Tests wrong or incomplete vs agreed specs |
| Developer | Spec Author | Spec impossible / underspecified |
| Developer | Architect | Blocked on layering / public API |
| Developer | HITL | Product tradeoff |
| Fixer | Reviewer | All listed review findings addressed (`FIXED`) |
| Fixer | Test / Spec / Architect / HITL | Finding cannot be fixed in impl alone (rare; prefer Reviewer re-route) |
| Architect (design) | Spec Author | Bad boundaries in proposed specs |
| Architect (structure) | Developer | Impl violates approved architecture (first implement pass) |
| Architect | HITL | Module-split / public API Product call |
| Consistency | Spec / Test / Dev / Architect / HITL | Per finding class |
| Performance | Developer | Local regression during implement path |
| Performance | Architect | Needs structural change |
| Performance | HITL | Accept baseline |
| Reviewer | **Fixer** | Implementation / code-quality findings (not new features) |
| Reviewer | Test Author | Test quality / wrong assertions |
| Reviewer | Spec Author | Spec/docs wrong |
| Reviewer | Architect | Structural smell |
| Reviewer | HITL | Merge blocked / attempts exhausted / Product needed |

### Re-entry rules

**[FAC-011]** Any test change after `COVERAGE_PASS` → Spec coverage again → then `awaiting-dev`.

**[FAC-012]** Spec change touching component boundaries / public API → Architect design → Test (if
needed) → Spec coverage → Dev.

**[FAC-013]** Architecture doc change after structure pass → Architect structure (or design if
pre-Dev) before Consistency.

**[FAC-014]** Per directed back-edge, at most **2** invocations per slice; third → `hitl`.

---

## 7. Consistency

After Architect structure pass. Report-only PR comment.

Run `check:specs`, `check:design`, `check:questions`, `check:sample`. Trace claimed IDs across
matrix / docs → specs → tests → code.

| Finding | Next |
|---------|------|
| Docs / matrix / normative spec wrong | spec-author |
| Missing / weak acceptance coverage | test-author |
| Impl contradicts specs/tests | developer |
| Layering drift | architect |
| Unclear source of truth | hitl |

---

## 8. Performance

**[FAC-015]** Performance MUST run `npm run bench:perf` against the committed baseline. It MUST NOT
invent ad-hoc benchmarks.

**[FAC-016]** Pass when no metric regresses beyond **+5%** wall time vs baseline (absolute floor
1 ms). Improvement is allowed. Not every PR must show a speedup.

Tolerance constant: `PERF_TOLERANCE_RATIO = 0.05` in the bench script.

Baseline bump only after `Approved. Accept perf baseline.`

---

## 9. Spike shortcut

Spec Author may set `spike: true` → skip Test Author and Spec coverage; after Architect design go
`awaiting-dev`. Structure + Consistency + Perf + Reviewer still run.

---

## 10. Definition of Ready

Before Developer: [DEFINITION_OF_READY.md](DEFINITION_OF_READY.md) checklist complete, Spec coverage
`COVERAGE_PASS` (unless spike), `stage-red` / `red-stage` satisfied for non-spike slices.
