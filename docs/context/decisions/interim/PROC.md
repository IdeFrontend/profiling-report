# Interim PROC rules

Provisional engineering defaults for **PROC** questions — **not Product-final**. Each rule derives a sub-letter id from its question id.

Meta-rules, MVP scope checklist, and related specs: [README.md](README.md).

### PROC-2a — `.ncrep` vs `.rep`

**Status:** `interim`
**Question:** [PROC-2](../../questions/PROC.md)
**Interim:** **Same binary layout and magic**; treat as product aliases for one parser.
**Implement / test as:** One `RepAdapter`; both extensions open Timeline
**Superseded when:** Product defines divergence (version field, required embeds)
