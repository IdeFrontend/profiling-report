# Open Questions Before Complete Specs

Status values: **Open** | **Proposed** | **Resolved** (link the resolving spec when Resolved).

Answers must update the relevant specs ([REP_FORMAT](../specs/formats/REP_FORMAT.md), [METRICS_AND_TRACE](../specs/formats/METRICS_AND_TRACE.md), [FEATURE_MATRIX](../specs/ui/FEATURE_MATRIX.md), etc.). Do not leave permanent TBDs only in code.

## Why specs are incomplete

Current docs capture **goals and UI sketches**, but several **producers, formulas, fixtures, and product decisions** are unknown. The sample [`data/out.rep`](../../data/out.rep) does not match sketch richness (pipe-state AIV0 vs multi-core instruction Gantt). Until the items below are resolved, format/UI specs cannot be treated as acceptance-complete.

## What you can still do without P0 answers

- Process and agent/skills docs
- UI interaction prose that is data-independent
- Container binary layout / format comparison (largely done)
- Swimlane renderer research (done)

## What is not “complete” until P0

- End-to-end data → widget mapping for MVP summary and overview charts
- Swimlane lane taxonomy matching product sketches
- Golden acceptance fixtures for e2e

## Stakeholder starter pack

Please provide:

1. One representative **production-like** `.ncrep` / `.rep` (or explicit confirmation that `data/out.rep` is the target shape)
2. Answers to questions **Q1, Q3, Q4, Q5, Q6**

---

## P0 — Block complete format + MVP UI specs

| ID | Question | Status | Specs to update when resolved |
|----|----------|--------|-------------------------------|
| **Q1** | **Producer of `.rep` / `.ncrep`.** Which tool/version writes the container (msprof? another CANN tool)? Is there an existing normative producer document we must align with, or is [REP_FORMAT](../specs/formats/REP_FORMAT.md) the first normative write-up? | Open | REP_FORMAT, FORMATS_COMPARISON |
| **Q2** | **`.ncrep` vs `.rep`.** Same magic/layout forever, or planned divergence (version field, required embeds)? Who owns product extension naming? | Open | REP_FORMAT, FORMATS_COMPARISON, MSTT_INTEGRATION |
| **Q3** | **Required embeds.** Minimum file set to open Timeline successfully (`trace.json` only? + `OpBasicInfo` + `PipeUtilization`?). Behavior when optional CSVs are missing (hide panels vs hard error). | Open | REP_FORMAT, METRICS_AND_TRACE, FEATURE_MATRIX |
| **Q4** | **Authoritative MVP fixture.** Will product traces look like the sketches (multi-core Cube/Vec instruction lanes, named ops, ProfilerStep, deps) or like `out.rep` (pipe busy intervals)? Need a representative golden for UI/data mapping; current sample is insufficient for sketch-faithful specs. | Open | METRICS_AND_TRACE, UI_OVERVIEW, FEATURE_MATRIX, TESTING |
| **Q5** | **Cube/Vector overview charts data source.** Sketches show **time-series** area charts; CSVs are **per-block aggregates**. Derive from trace busy intervals, from a missing time-series embed, or drop/simplify for MVP? | Open | METRICS_AND_TRACE, UI_OVERVIEW, FEATURE_MATRIX |
| **Q6** | **Report summary formulas.** Exact definitions for compute power (e.g. sketch values like 172/320 TFLOPS), I/O bandwidth tiles, avg core util % — which columns, and which aggregation (mean vs max across `block_id`)? | Open | METRICS_AND_TRACE, UI_OVERVIEW |
| **Q7** | **Hardware details sidebar source.** Host CPU, NPU chip (`Ascend950…`), HBM are not in sample `.rep`. Separate embed? Host-injected metadata? Phase 2 only? | Open | METRICS_AND_TRACE, UI_OVERVIEW, FEATURE_MATRIX, ARCHITECTURE |
| **Q8** | **Lane hierarchy mapping.** Rules from Chrome Trace `thread_name` / pid/tid → `CoreN.Cube` / pipe children. Fixed producer naming convention, or viewer heuristics? | Open | METRICS_AND_TRACE, UI_OVERVIEW, ARCHITECTURE |

---

## P1 — Block complete interaction / Phase 2 specs

| ID | Question | Status | Specs to update when resolved |
|----|----------|--------|-------------------------------|
| **Q9** | **Dependencies encoding.** Field names in `trace.json` args (or side file) for predecessors/successors; or explicitly out of scope until the producer defines it. | Open | METRICS_AND_TRACE, INTERACTIONS, FEATURE_MATRIX |
| **Q10** | **Source / Details / Cache tabs.** Data contracts (BIN? paths in event args? L2Cache only?). Relationship to keeping Insight for `.bin`. | Open | FEATURE_MATRIX, MSTT_INTEGRATION, FORMATS_COMPARISON |
| **Q11** | **Roofline.** Axes, peak lines, how points (`Vec_FP32`, …) are computed from `ArithmeticUtilization` (+ Memory?). | Open | METRICS_AND_TRACE, UI_OVERVIEW, FEATURE_MATRIX |
| **Q12** | **Memory topology.** Which CSV fields map to which diagram edges; static diagram vs data-driven thicknesses. | Open | METRICS_AND_TRACE, UI_OVERVIEW |
| **Q13** | **Color / category legend.** Normative colors for Cube/Vector/MTE/FixP/Scalar and event types (match sketches vs MSTT theme tokens). | Open | UI_OVERVIEW, ARCHITECTURE |
| **Q14** | **Time units UX.** Default display ns vs µs vs ms; clock-cycle mode — frequency from where (`OpBasicInfo` Current Freq?)? | Open | INTERACTIONS, UI_OVERVIEW, METRICS_AND_TRACE |
| **Q15** | **MSTT `.json` policy.** Always Insight, or Chrome Trace `.json` → profiling-report? | Open | FORMATS_COMPARISON, MSTT_INTEGRATION |

---

## P2 — Block packaging / process / skills completeness

| ID | Question | Status | Specs to update when resolved |
|----|----------|--------|-------------------------------|
| **Q16** | **Package identity.** npm package name, license for *this* repo, publish to registry vs MSTT workspace path dependency. | Open | ARCHITECTURE, PROJECT_GOALS, root Readme |
| **Q17** | **Design system.** Ant Design Vue (MSTT-aligned) vs custom CSS matching sketches; i18n default locale (zh-CN vs en). | Open | UI_OVERVIEW, ARCHITECTURE, PROJECT_GOALS |
| **Q18** | **PyPTO copy-paste license clearance.** Confirm CANN OSL / internal policy before treating “copy render helpers” as an official approach. | Open | DEVELOPMENT, SWIMLANE_IMPLEMENTATIONS, ARCHITECTURE |
| **Q19** | **Gesture parity.** Must MVP match PyPTO shortcuts (W/S/A/D) or only wheel/slider? | Open | INTERACTIONS, FEATURE_MATRIX |
| **Q20** | **Cursor skills / agent rules.** Which skills to add (e.g. update FEATURE_MATRIX + test ids when changing MVP; never code before Ready checklist)? | Open | process docs, `.cursor` skills/rules |
| **Q21** | **Acceptance owner.** Who signs off P0 answers (OP tooling? frontend? profiling backend)? | Open | PROJECT_GOALS, this file |

---

## Resolution log

| ID | Resolved date | Summary | Link |
|----|---------------|---------|------|
| — | — | None yet | — |
