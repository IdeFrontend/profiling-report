# PROC decisions

Product-final answers to **PROC** questions (process / tooling / acceptance) that have left the open list. Each entry keeps the **same bare id** as its question in [OPEN_QUESTIONS.md](../OPEN_QUESTIONS.md), plus a `Was` reference to the pre-merge id.

Normative truth lives in the owning **specs** (linked per entry); this log is the traceability record, not the source of truth.

Format and statuses: [README.md](README.md).

---

## PROC-1 (was: Q1)

- **Resolved:** 2026-07-31
- **Question:** Producer of `.rep` / `.ncrep`?
- **Decision:** Tool WIP. Use the sample `.rep` + [REP_FORMAT](../../formats/REP_FORMAT.md) until the producer spec lands.
- **Specs:** [REP_FORMAT](../../formats/REP_FORMAT.md)

---

## PROC-3 (was: Q15)

- **Resolved:** 2026-07-31
- **Question:** MSTT `.json` policy?
- **Decision:** Chrome Trace `.json` → profiling-report.
- **Specs:** [MSTT_INTEGRATION](../../architecture/MSTT_INTEGRATION.md)

---

## PROC-4 (was: Q20)

- **Resolved:** 2026-08-12
- **Question:** Cursor skills / agent rules location?
- **Decision:** Shared rules in [`AGENTS.md`](../../../AGENTS.md) (+ nested `specs/AGENTS.md`, `specs/CLAUDE.md` → `@./AGENTS.md`), skills in `.agents/skills/`. Cursor-only: `.cursor/rules/code-review-post-github.mdc`. Root Claude: [`CLAUDE.md`](../../../CLAUDE.md) → `@AGENTS.md`.
- **Specs:** [`AGENTS.md`](../../../AGENTS.md), [`CLAUDE.md`](../../../CLAUDE.md)
