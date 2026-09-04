# Interim engineering decisions (MVP unblock)

Provisional engineering defaults — **not Product-final**. They exist so MVP implementation and tests can proceed while producer / data specs are incomplete.

Stored one file per ID prefix: [DATA.md](DATA.md), [UI.md](UI.md), [PROC.md](PROC.md), [PKG.md](PKG.md). Each rule derives a sub-letter id from its question id (e.g. `DATA-33b`), links back to the question in [questions/](../../questions/), and records **what to build now** and **when to throw the guess away**.

## Meta-rules

| Rule | Detail |
|------|--------|
| Status label | `interim` — never write as `resolved` product truth |
| Supersede | When Product or the format/data spec answers the linked question: write the decision into owning specs, **remove** the row from [questions/](../../questions/) and file a [resolved entry](../README.md), delete or strike this interim rule, and scrub "until Q*" wording — all in the **same change**. See [DEVELOPMENT.md § Resolving open questions](../../../process/DEVELOPMENT.md#resolving-open-questions). |
| Tests | Assert interim behavior; titles may note `(interim)` |
| Code comments | Prefer linking this file / the question id over inventing silent TBDs |

Canonical Product answers live in the owning **specs** after resolution (see [DEVELOPMENT.md § Resolving open questions](../../../process/DEVELOPMENT.md#resolving-open-questions)). The open list holds unanswered items only: [questions/](../../questions/); Product-final decisions: [resolved entries](../). Packaging proposals that Product has not confirmed: [PACKAGING_SUGGESTIONS](../../PACKAGING_SUGGESTIONS.md) (also interim until accepted).

## MVP scope under interims (checklist)

Allowed to implement now:

1. Tooling scaffold (Vitest, Playwright, playground)
2. `.rep` / `.ncrep` parse (alias) + Chrome Trace → `SwimlaneModel`
3. Standalone Chrome Trace `.json` open path
4. Timeline shell, axis, gutter, swimlane, tooltip, select → detail
5. PIPE bars when `PipeUtilization` present
6. Thin summary (name / type / duration only)
7. Hide overview, undecidable summary tiles, missing panels

Not required for first MVP merge:

- Sketch-faithful multi-core golden
- Full report stats tiles (compute / avg util) — I/O BW shipped under DATA-33g
- Overview charts with real series
- Product-final hardware inventory beyond DATA-34a; roofline tabs / L2 series beyond DATA-37*; memory SVG; deps; secondary tabs
- Clock-cycle display mode

## Related specs to keep in sync

- [VIEW_DATA_REQUIREMENTS.md](../../../formats/VIEW_DATA_REQUIREMENTS.md)
- [FEATURE_MATRIX.md](../../../ui/FEATURE_MATRIX.md)
- [METRICS_AND_TRACE.md](../../../formats/METRICS_AND_TRACE.md)
- [REP_FORMAT.md](../../../formats/REP_FORMAT.md)
- [TESTING.md](../../../process/TESTING.md)
- [DEVELOPMENT.md](../../../process/DEVELOPMENT.md)
