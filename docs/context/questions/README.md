# Open questions

Single source of truth for unanswered product / engineering questions, stored **one file per ID prefix**. **Status is a field** on each record; which store it lives in is derived from that field.

| File | Prefix | Contents |
|------|--------|----------|
| [DATA.md](DATA.md) | `DATA-*` | File/field/formula data mapping |
| [UI.md](UI.md) | `UI-*` | Presentation / UX |
| [PROC.md](PROC.md) | `PROC-*` | Process / tooling / acceptance |
| [PKG.md](PKG.md) | `PKG-*` | Packaging / distribution |
| [deferred.md](deferred.md) | any | Parked (backlog) questions — status `deferred` |

**Statuses (single enum):** `open` | `partial` | `interim` | `deferred` | `resolved`

- `open` / `partial` — live here (the per-prefix files).
- `interim` — engineering default only; the rule lives in [../decisions/interim/](../decisions/interim/) under a sub-letter id (e.g. `DATA-33b`). The question row stays here.
- `deferred` — Product-confirmed out of this iteration; parked in [deferred.md](deferred.md) (backlog), never renumbered.
- `resolved` — Product-final; the entry lives in [../decisions/](../decisions/), keeping the **same bare id**.

**When resolved:** write the decision into the owning specs **and** file a [../decisions/](../decisions/) entry in the **same change**; remove the row here. Process: [DEVELOPMENT.md § Resolving open questions](../../process/DEVELOPMENT.md#resolving-open-questions).

**Scope.** This folder is the **question ledger** — what is open and what Product still owes us: each question, its status, and the answer so far. It does **not** hold interim rule text, implement/test mapping, or the MVP build checklist — those are engineering execution, not question content, and live in [../decisions/interim/](../decisions/interim/). A question with status `interim` keeps its row here and points at the sub-letter rule there (e.g. `DATA-33b`).

## ID prefix taxonomy (closed set)

- `DATA-*` — file/field/formula data mapping (report data → visualized number/series/edge).
- `UI-*` — presentation / UX (layout, units, gestures, missing-input, labels).
- `PROC-*` — process / tooling / acceptance (producer, container format, MSTT policy, agent rules, acceptance owner).
- `PKG-*` — packaging / distribution (package identity, design system/i18n, licensing).

IDs are **permanent** — retire with a `WITHDRAWN` / `DEFERRED` marker in place, never delete or renumber (they are referenced by `@covers` test comments, specs, code comments, and design crops).

## Migration map (one-time, from the pre-merge spaces)

| Old id | New id |
|--------|--------|
| `HQ 1–29` | `DATA-1 … DATA-29` |
| `HQ 30–36` | `UI-30 … UI-36` |
| `HQ 37` | `UI-43` |
| `Q3/Q4/Q5/Q6/Q7/Q8/Q9/Q11` | `DATA-30 … DATA-37` |
| `Q10/Q12/Q13/Q14/Q19/Q22` | `UI-37 … UI-42` |
| `Q1/Q2/Q15/Q20/Q21` | `PROC-1 … PROC-5` |
| `Q16/Q17/Q18` | `PKG-1 … PKG-3` |
| `I-Q2` | `PROC-2a` |
| `I-Q4` | `DATA-31a` |
| `I-Q5+` | `DATA-32a` |
| `I-Q6a–g` | `DATA-33a…DATA-33g` |
| `I-Q6h` | `DATA-33h` |
| `I-Q7a` | `DATA-34a` |
| `I-Q9` | `DATA-36a` |
| `I-Q11a–f` | `DATA-37a…DATA-37f` |
| `I-Q14` | `UI-40a` |
| `I-Q16–19` | `PKG-1a…PKG-3a`, `UI-41a` |
| `D-PIN-FOLDER` | `UI-44` |
| `Q23` / `HQ 38` | `UI-45` |
