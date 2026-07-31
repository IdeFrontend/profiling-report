# Interim Engineering Decisions (MVP Unblock)

**These are not Product-final decisions.** They exist so MVP implementation and tests can proceed while producer / data specs are incomplete.

| Rule | Detail |
|------|--------|
| Status label | **Interim** — never write as **Resolved** product truth |
| Supersede | When Product or the format/data spec answers the linked Q*, update that Q to Resolved/Proposed, delete or strike the row here, and fix dependent specs in the **same PR** |
| Tests | Assert interim behavior; titles may note `(interim)` |
| Code comments | Prefer linking this file / Q id over inventing silent TBDs |

Canonical Product answers stay in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md). Packaging proposals that Product has not confirmed: [PACKAGING_SUGGESTIONS.md](PACKAGING_SUGGESTIONS.md) (also interim until accepted).

---

## Interim table (MVP)

| ID | Topic | Interim decision | Implement / test as | Superseded when |
|----|-------|------------------|---------------------|-----------------|
| **I-Q2** | `.ncrep` vs `.rep` | **Same binary layout and magic**; treat as product aliases for one parser | One `RepAdapter`; both extensions open Timeline | Product defines divergence (version field, required embeds) |
| **I-Q4** | Golden fixture | Primary CI/playground fixture = [`data/out.rep`](../../data/out.rep). Acceptance = parse + render + hide rules — **not** sketch pixel-parity | e2e `PR-E2E-001` on `out.rep`; optional later synthetic sketch-like fixture | Sketch-faithful production golden arrives (Product Q4 target) |
| **I-Q6a** | Summary tiles | Show only **clear** `OpBasicInfo` fields: op name, op type, task duration (and freq fields if present as raw values). **Hide** compute TFLOPS, I/O BW, and avg core util tiles | Thin `StatsSummaryPanel` | Data/format spec defines formulas (Q6) |
| **I-Q6b** | PIPE aggregation | **Mean of non-`NA` ratios** per pipe family across `block_id` | `PipeOccupancyPanel` unit tests | Q6 / data spec overrides aggregation |
| **I-Q5+** | Overview series | Adapter returns `overviewSeries: []`; UI **hides** charts (aligns with Product Q5) | No fake series from CSV | Producer defines `OverviewSeries` source |
| **I-Q14** | Time units | Configurable display: **ms / µs / ns** only. Default **ms**. **No** clock-cycle mode in MVP | Formatter + host/locale pref prop | Product specifies cycle mode + frequency source |
| **I-Q16–19** | Packaging / UX chrome | Follow [PACKAGING_SUGGESTIONS.md](PACKAGING_SUGGESTIONS.md) as if accepted for scaffold | Repo-root `src/`, Ant Design + custom swimlane CSS, zh-CN default + EN keys, wheel/slider MVP gestures | Product confirm/change each Q16–Q19 |

---

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
- Full report stats tiles (compute / BW / avg util)
- Overview charts with real series
- Hardware aside, roofline, memory SVG, deps, secondary tabs
- Clock-cycle display mode

---

## Related specs to keep in sync

- [VIEW_DATA_REQUIREMENTS.md](../specs/formats/VIEW_DATA_REQUIREMENTS.md)
- [FEATURE_MATRIX.md](../specs/ui/FEATURE_MATRIX.md)
- [METRICS_AND_TRACE.md](../specs/formats/METRICS_AND_TRACE.md)
- [REP_FORMAT.md](../specs/formats/REP_FORMAT.md)
- [TESTING.md](../process/TESTING.md)
- [DEVELOPMENT.md](../process/DEVELOPMENT.md)
