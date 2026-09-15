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

---

## PROC-6

- **Resolved:** 2026-09-14
- **Question:** Does npu_emulate / Ascend simulator profiling use the same host report extension as hardware OP profiling?
- **Decision:** Yes. Emulate reports ship as **`.npu-rep`** (nested leaf per kernel/OP), same host open contract as npu-compute ([PROC-2](./PROC.md)). No second host extension.
- **Specs:** [INPUT_FORMATS](../../formats/INPUT_FORMATS.md), [emulate/FORMAT](../../formats/emulate/FORMAT.md), [MSTT_INTEGRATION](../../architecture/MSTT_INTEGRATION.md), [FEATURE_MATRIX](../../ui/FEATURE_MATRIX.md), [PROJECT_GOALS](../PROJECT_GOALS.md)
- **Source:** Product MHTML npu-emulate 仿真 §11.2.1.2 (`report_<timestamp>_<rand id>.npu-rep`)

---

## PROC-7

- **Resolved:** 2026-09-14
- **Question:** Are compute and emulate payloads the same embed set inside `.npu-rep`?
- **Decision:** No. Two **payload profiles** share the container binary: `compute` (npu-compute OpBasicInfo / PipeUtilization / Memory* / PipeTrace…) and `emulate` (npu_emulate contract CSVs / Chrome Trace / summary + `EmulateManifest.json`). Different adapters fill the same view-models.
- **Specs:** [INPUT_FORMATS](../../formats/INPUT_FORMATS.md), [compute/FORMAT](../../formats/compute/FORMAT.md), [emulate/FORMAT](../../formats/emulate/FORMAT.md), [ADAPTERS](../../formats/ADAPTERS.md), [FORMATS_COMPARISON](../../formats/FORMATS_COMPARISON.md)
- **Source:** Engineering + product emulate §11.2.3 (simulator CSV names, not hardware schemas)

---

## PROC-8

- **Resolved:** 2026-09-14
- **Question:** How does the viewer detect a emulate leaf vs a compute leaf?
- **Decision:** Require embed **`EmulateManifest.json`** with `"profile": "emulate"` (and `schemaVersion`). Absence → compute (or CTEF-only). Head `origin` remains **`1`** until Product defines a dedicated emulate origin ([PROC-9](../questions/PROC.md)).
- **Specs:** [INPUT_FORMATS](../../formats/INPUT_FORMATS.md) §2.1, [emulate/FORMAT](../../formats/emulate/FORMAT.md), [ADAPTERS](../../formats/ADAPTERS.md), [npu-rep](../../../specs/core/npu-rep.spec.md), [load-report-source](../../../specs/core/load-report-source.spec.md)
- **Source:** Engineering default for dual-profile detection without parser origin change
