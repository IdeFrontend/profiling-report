# Open Questions Before Complete Specs

Status values: **Open** | **Proposed** | **Resolved** | **Interim** (engineering default — see [INTERIM_DECISIONS.md](INTERIM_DECISIONS.md); not Product-final).

Answers must update the relevant specs ([REP_FORMAT](../formats/REP_FORMAT.md), [METRICS_AND_TRACE](../formats/METRICS_AND_TRACE.md), [VIEW_DATA_REQUIREMENTS](../formats/VIEW_DATA_REQUIREMENTS.md), [FEATURE_MATRIX](../ui/FEATURE_MATRIX.md), [UX_SPEC](../ui/UX_SPEC.md), [COMPONENTS](../architecture/COMPONENTS.md), etc.). Do not leave permanent TBDs only in code.

## Why Product-complete specs are still incomplete

Producer **format/data specification is still forthcoming**. Product has answered many P0 items; remaining Product gaps (especially **Q6 formulas** and a **sketch-faithful golden**) are covered by **Interim** defaults so MVP coding can start.

**MVP unblock doc:** [INTERIM_DECISIONS.md](INTERIM_DECISIONS.md)

## What you can do now

- Implement per [INTERIM_DECISIONS](INTERIM_DECISIONS.md) + [VIEW_DATA_REQUIREMENTS](../formats/VIEW_DATA_REQUIREMENTS.md)
- Timeline with minimal data; hide panels without inputs (Q3)
- Hide overview charts (Q5 / I-Q5+)
- Thin summary + PIPE mean aggregation (I-Q6a / I-Q6b)
- Fixture `data/out.rep` for CI (I-Q4); colors [COLOR_TOKENS](../ui/COLOR_TOKENS.md)
- Open Chrome Trace `.json` in profiling-report (Q15)
- Packaging scaffold per [PACKAGING_SUGGESTIONS](PACKAGING_SUGGESTIONS.md) (I-Q16–19)

## Still blocking Product-final (not coding) acceptance

- Exact summary tile formulas (Q6) — interim hides undecidable tiles
- Production-like multi-core instruction golden (Q4 target) — interim uses `out.rep`
- Overview chart producer — interim keeps charts hidden
- Phase 2 contracts Q9–Q11, Q10
- Measure-range cross-view sync (Q22)

---

## P0 — Format + MVP UI

| ID | Question | Status | Specs / notes |
|----|----------|--------|---------------|
| **Q1** | Producer of `.rep` / `.ncrep` | **Resolved** | Tool WIP. Sample `.rep` + [REP_FORMAT](../formats/REP_FORMAT.md) until producer spec. |
| **Q2** | `.ncrep` vs `.rep` | **Interim** | Same layout/alias — [I-Q2](INTERIM_DECISIONS.md). |
| **Q3** | Required embeds / missing data | **Resolved** | Minimal open; **hide** missing panels. → [VIEW_DATA_REQUIREMENTS](../formats/VIEW_DATA_REQUIREMENTS.md) |
| **Q4** | Authoritative MVP fixture shape | **Resolved (target)** + **Interim (fixture)** | Product target = sketch-like Gantt (A). **CI fixture** = `out.rep` until golden — [I-Q4](INTERIM_DECISIONS.md). |
| **Q5** | Overview charts data source | **Resolved** | **Hide** until `OverviewSeries` (C). Adapter `[]` — [I-Q5+](INTERIM_DECISIONS.md). |
| **Q6** | Report summary formulas | **Interim** | Thin OpBasicInfo tiles only; hide compute/BW/avg util; PIPE = mean non-`NA` — [I-Q6a](INTERIM_DECISIONS.md) / [I-Q6b](INTERIM_DECISIONS.md). **PIPE layout:** **Cube \| Vector toggle for MIX** ops ([`v930/compute-load`](../ui/source/v930/compute-load.jpeg)); non-MIX shows the relevant side only. Block-scoped details vs mean bars — [I-Q6c](INTERIM_DECISIONS.md). |
| **Q7** | Hardware details sidebar | **Resolved (MVP)** | **Out of MVP** until further product/spec docs. |
| **Q8** | Lane hierarchy mapping | **Resolved (interim naming)** | Producer fixed naming (A); may revisit. No viewer heuristics. |

---

## P1 — Interaction / Phase 2

| ID | Question | Status | Specs |
|----|----------|--------|-------|
| **Q9** | Dependencies encoding | Open | METRICS_AND_TRACE, INTERACTIONS, UX_SPEC, FEATURE_MATRIX, COMPONENTS |
| **Q10** | Source / Details / Cache tabs | Open | FEATURE_MATRIX, UX_SPEC, MSTT_INTEGRATION, FORMATS_COMPARISON |
| **Q11** | Roofline formulas | Open | METRICS_AND_TRACE, UI_OVERVIEW, FEATURE_MATRIX, COMPONENTS |
| **Q12** | Memory topology | **Resolved** | Static SVG + data-driven edge labels. |
| **Q13** | Color / category legend | **Resolved** | [COLOR_TOKENS.md](../ui/COLOR_TOKENS.md) |
| **Q14** | Time units UX | **Resolved (partial)** + **Interim (MVP units)** | Configurable; MVP = ms/µs/ns only, default ms; no cycles — [I-Q14](INTERIM_DECISIONS.md). |
| **Q15** | MSTT `.json` policy | **Resolved** | Chrome Trace `.json` → profiling-report. |
| **Q22** | Time-range measure → which views? | **Open** | When timeline **度量模式** sets `measureRange [t0,t1]` ([`v930/task-measure-mode`](../ui/source/v930/task-measure-mode.jpeg)), which views must update? Candidates: PIPE / Cube·Vector bars; compute-load detail tabs; memory detail tabs + topology; report summary; detail strip; overview charts (if present). Distinct from overview brush (`timeWindow`) and event selection. Until answered: measure UI is **local overlay only** (band + Δt; no aside recompute). Specs when answered: UX_SPEC sync, INTERACTIONS, FEATURE_MATRIX, COMPONENTS, view-state / StatsAside. |

---

## P2 — Packaging / process

| ID | Question | Status | Specs |
|----|----------|--------|-------|
| **Q16** | Package identity | **Interim** | [PACKAGING_SUGGESTIONS](PACKAGING_SUGGESTIONS.md) / [I-Q16–19](INTERIM_DECISIONS.md) |
| **Q17** | Design system / i18n | **Interim** | same |
| **Q18** | PyPTO copy-paste license | **Interim** | same — Legal before verbatim paste |
| **Q19** | Gesture parity | **Interim** | Wheel/slider/drag MVP; W/S/A/D P2 |
| **Q20** | Cursor skills / agent rules | Open | process docs, `.cursor` skills/rules |
| **Q21** | Acceptance owner | Open | PROJECT_GOALS, this file |

---

## Resolution log

| ID | Resolved date | Summary | Link |
|----|---------------|---------|------|
| Q1 | 2026-07-31 | Producer WIP; use sample `.rep` until format spec | REP_FORMAT |
| Q3 | 2026-07-31 | Minimal open; hide missing panels | VIEW_DATA_REQUIREMENTS |
| Q4 | 2026-07-31 | Target = sketch-like multi-core Gantt (A) | UI_OVERVIEW, METRICS gap |
| Q5 | 2026-07-31 | Hide overview until OverviewSeries (C) | VIEW_DATA_REQUIREMENTS |
| Q7 | 2026-07-31 | Hardware aside out of MVP | FEATURE_MATRIX |
| Q8 | 2026-07-31 | Producer fixed naming for now (A) | METRICS_AND_TRACE |
| Q12 | 2026-07-31 | Static SVG + data-driven labels | VIEW_DATA_REQUIREMENTS |
| Q13 | 2026-07-31 | Sketch colors normative | COLOR_TOKENS |
| Q14 | 2026-07-31 | Time unit configurable | INTERACTIONS |
| Q15 | 2026-07-31 | `.json` → profiling-report | MSTT_INTEGRATION |
| Q16–Q19 | 2026-07-31 | Engineering proposals filed | PACKAGING_SUGGESTIONS |
| Interim set | 2026-07-31 | I-Q2, I-Q4, I-Q6a/b, I-Q5+, I-Q14, I-Q16–19 for MVP code | INTERIM_DECISIONS |
