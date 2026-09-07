# PROC decisions

Product-final answers to **PROC** questions (process / tooling / acceptance) that have left the open list. Each entry keeps the **same bare id** as its question in [questions/](../questions/), plus a `Was` reference to the pre-merge id.

Normative truth lives in the owning **specs** (linked per entry); this log is the traceability record, not the source of truth.

Format and statuses: [README.md](README.md).

---

## PROC-1 (was: Q1)

- **Resolved:** 2026-07-31
- **Question:** Producer of `.rep` / `.ncrep`?
- **Decision:** Tool WIP. Use the sample `.rep` + [REP_FORMAT](../../formats/REP_FORMAT.md) until the producer spec lands.
- **Specs:** [REP_FORMAT](../../formats/REP_FORMAT.md)

---

## PROC-2 (was: Q2)

- **Resolved:** 2026-09-07
- **Was:** interim [PROC-2a](interim/PROC.md)
- **Question:** `.ncrep` vs `.rep` (host / product file extension)?
- **Decision:** The official product and MSTT plugin report extension is **`.npu-rep` only**. Hosts do **not** treat `.rep` or `.ncrep` as supported product aliases. Classic `cann-rep` / sample `.rep` files remain engineering fixtures and a local packer path inside the library, not the plugin open contract. Nested leaf names inside an `npu-rep` container (e.g. `op1.npu.rep`) are FileInfo names, not the host file extension.
- **Specs:** [REP_FORMAT](../../formats/REP_FORMAT.md), [npu-rep](../../../specs/core/npu-rep.spec.md), [MSTT_INTEGRATION](../../architecture/MSTT_INTEGRATION.md), [FEATURE_MATRIX](../../ui/FEATURE_MATRIX.md), [UX_SPEC](../../ui/UX_SPEC.md), [DOMAIN_AND_USERS](../DOMAIN_AND_USERS.md), [PROJECT_GOALS](../PROJECT_GOALS.md)
- **Source:** Product (2026-09-07) — plugin officially supports only `.npu-rep`

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
