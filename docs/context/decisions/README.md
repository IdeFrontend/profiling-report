# Decisions (resolved open questions)

Product-final answers that have left the open list, stored **one file per ID prefix**.

| File | Prefix | Contents |
|------|--------|----------|
| [DATA.md](DATA.md) | `DATA-*` | File/field/formula data mapping |
| [UI.md](UI.md) | `UI-*` | Presentation / UX |
| [PROC.md](PROC.md) | `PROC-*` | Process / tooling / acceptance |
| [PKG.md](PKG.md) | `PKG-*` | Packaging / distribution |

Each entry keeps the **same bare id** as its question in [OPEN_QUESTIONS.md](../OPEN_QUESTIONS.md), plus a `Was` reference to the pre-merge id.

## Format

- **ID** — same bare id as the question + `(was: <old HQ n / Qn>)`
- **Resolved** — date
- **Question** — short
- **Decision** — normative one-liner
- **Specs** — owning docs updated in the same change (normative truth lives here, not in this log)
- **Source** — Product answer reference (docx hash / PR # / doc)

**Status:** `resolved` is the only status recorded in this folder; see [OPEN_QUESTIONS.md](../OPEN_QUESTIONS.md) for the full enum.

Process: [DEVELOPMENT.md § Resolving open questions](../../process/DEVELOPMENT.md#resolving-open-questions).
