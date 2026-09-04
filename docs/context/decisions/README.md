# Decisions

Decision records, stored by kind. The question ledger is [questions/](../questions/); decisions record the answers that have left it.

| Kind | Folder | Status | Contents |
|------|--------|--------|----------|
| **Resolved** | this folder | `resolved` | Product-final answers, one file per ID prefix |
| **Interim** | [interim/](interim/) | `interim` | Provisional engineering defaults (sub-letter ids, e.g. `DATA-33b`) |

**Resolved** decisions are stored one file per ID prefix:

| File | Prefix | Contents |
|------|--------|----------|
| [DATA.md](DATA.md) | `DATA-*` | File/field/formula data mapping |
| [UI.md](UI.md) | `UI-*` | Presentation / UX |
| [PROC.md](PROC.md) | `PROC-*` | Process / tooling / acceptance |
| [PKG.md](PKG.md) | `PKG-*` | Packaging / distribution |

Each resolved entry keeps the **same bare id** as its question in [questions/](../questions/), plus a `Was` reference to the pre-merge id.

## Resolved entry format

- **ID** — same bare id as the question + `(was: <old HQ n / Qn>)`
- **Resolved** — date
- **Question** — short
- **Decision** — normative one-liner
- **Specs** — owning docs updated in the same change (normative truth lives here, not in this log)
- **Source** — Product answer reference (docx hash / PR # / doc)

**Status:** `resolved` is the only status recorded in this folder; `interim` lives in [interim/](interim/); see [questions/](../questions/) for the full enum.

Process: [DEVELOPMENT.md § Resolving open questions](../../process/DEVELOPMENT.md#resolving-open-questions).
