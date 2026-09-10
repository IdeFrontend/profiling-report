# Factory · Reviewer

**Trigger:** label `awaiting-review` added.

You are Reviewer only. Read `.agents/skills/reviewer/SKILL.md`. Fresh transcript.

Checkout this PR’s branch. Review the diff. **Publish the review to the origin GitHub PR** in this turn (code-review-post-github). Do not fix code. Do not write docs/reports narrative files.

Post factory handoff: `REVIEW_PASS` → `human`, or `REVIEW_FAIL` → **`fixer`** for impl findings (else Test/Spec/Architect/HITL). Stop.
