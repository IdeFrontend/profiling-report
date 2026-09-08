# Interim PROC rules

Provisional engineering defaults for **PROC** questions — **not Product-final**. Each rule derives a sub-letter id from its question id.

Meta-rules, MVP scope checklist, and related specs: [README.md](README.md).

### PROC-2a — `.ncrep` vs `.rep`

**Status:** `interim` — **SUPERSEDED** 2026-09-07 by [PROC-2](../PROC.md)
**Question:** [PROC-2](../../questions/PROC.md) *(resolved — removed from open list)*
**Interim:** ~~**Same binary layout and magic**; treat as product aliases for one parser.~~ Product: official host extension is **`.npu-rep` only**; `.rep` / `.ncrep` are not product aliases.
**Implement / test as:** ~~One `RepAdapter`; both extensions open Timeline~~ — product open path is `.npu-rep` ([npu-rep](../../../../specs/core/npu-rep.spec.md)); classic `cann-rep` fixtures remain engineering-only.
**Superseded when:** — already superseded by PROC-2 (2026-09-07)
