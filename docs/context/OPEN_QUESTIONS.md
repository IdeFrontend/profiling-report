# Open Questions Before Complete Specs

Status values: **Open** | **Proposed** | **Interim** (engineering default — see [INTERIM_DECISIONS.md](INTERIM_DECISIONS.md); not Product-final) | **Obsolete** (UI/question retired; do not re-open).

Answers must update the relevant specs ([REP_FORMAT](../formats/REP_FORMAT.md), [METRICS_AND_TRACE](../formats/METRICS_AND_TRACE.md), [VIEW_DATA_REQUIREMENTS](../formats/VIEW_DATA_REQUIREMENTS.md), [FEATURE_MATRIX](../ui/FEATURE_MATRIX.md), [UX_SPEC](../ui/UX_SPEC.md), [COMPONENTS](../architecture/COMPONENTS.md), etc.). Do not leave permanent TBDs only in code.

**When resolved:** remove the row from the tables below and write the decision into those specs in the **same change**. Optional one-line entry in the resolution log. Process: [DEVELOPMENT.md § Resolving open questions](../process/DEVELOPMENT.md#resolving-open-questions).

**Do not** leave **Resolved** rows in the tables — they belong in the resolution log only.

## Why Product-complete specs are still incomplete

Producer **format/data specification is still forthcoming**. Product has answered many P0 items; remaining Product gaps (especially **AICore parallel formulas**, bandwidth **peak/score**, and a **sketch-faithful golden**) are covered by **Interim** defaults so MVP coding can continue.

**MVP unblock doc:** [INTERIM_DECISIONS.md](INTERIM_DECISIONS.md)

**Right-panel field / UX ledger:** [HQ_OPEN_QUESTIONS.md](HQ_OPEN_QUESTIONS.md) (HQ DATA 1–29, HQ UI/UX 30–36). Those HQ numbers are not the Q1–Q23 ids in the tables below. HQ keeps **ANSWERED** / **OBSOLETE** notes in place; this file only lists still-open / interim product gaps.

## What you can do now

- Implement per [INTERIM_DECISIONS](INTERIM_DECISIONS.md) + [VIEW_DATA_REQUIREMENTS](../formats/VIEW_DATA_REQUIREMENTS.md)
- Timeline with minimal data; hide panels without inputs (resolved Q3)
- Hide overview charts (resolved Q5 / I-Q5+)
- Summary **2×2**: duration (I-Q6e); compute Cube\|Vector (I-Q6h); bandwidth 读\|写 (I-Q6g); AICore parallel **N/A** until HQ 9–10
- PIPE mean aggregation (I-Q6b)
- Fixture `data/out.rep` for CI (I-Q4); colors [COLOR_TOKENS](../ui/COLOR_TOKENS.md)
- Open Chrome Trace `.json` in profiling-report (resolved Q15)
- Packaging scaffold per [PACKAGING_SUGGESTIONS](PACKAGING_SUGGESTIONS.md) (I-Q16–19)

## Still blocking Product-final (not coding) acceptance

- AICore **并行使用率** / **负载均衡度** formulas (HQ 9–10) — card ships as **N/A**
- Bandwidth **peak / score** (HQ 5–8; I-Q6g guess 1600 GB/s; sketch 81 ≠ ratio); 读\|写 aggregation
- Compute **Product-final** MFU / fixed chip peaks / dtype (HQ 2–3 partial; I-Q6h interim)
- Production-like multi-core instruction golden (Q4 target) — interim uses `out.rep`
- Overview chart producer — interim keeps charts hidden
- Phase 2 contracts Q9–Q11 (deps / tabs / roofline), OPEN Q10

---

## P0 — Format + MVP UI

| ID | Question | Status | Specs / notes |
|----|----------|--------|---------------|
| **Q2** | `.ncrep` vs `.rep` | **Interim** | Same layout/alias — [I-Q2](INTERIM_DECISIONS.md). |
| **Q4** | Authoritative MVP fixture shape | **Interim** | Product target = sketch-like Gantt. **CI fixture** = `out.rep` until golden — [I-Q4](INTERIM_DECISIONS.md). |
| **Q6** | Report summary formulas | **Interim** | **Shipped interim:** duration [I-Q6e]; compute Cube\|Vector [I-Q6h] (HQ 2–4, Q33); bandwidth **measured** + 读\|写 card [I-Q6g] (HQ 34 GB/s). PIPE mean — [I-Q6b](INTERIM_DECISIONS.md). MIX Cube\|Vector + ICache Miss confirmed. **Still open:** AICore 并行使用率 / 负载均衡度 (HQ 9–10; **N/A** via [I-Q6a](INTERIM_DECISIONS.md)); BW peak/score/aggregation (HQ 5–8); compute MFU/chip peaks/dtype; `block_id` mean vs max vs selected (HQ 28–29). **Obsolete:** former 平均核利用率 / 启用 n/m 核 card chrome; separate 输入/输出 × aic\|aiv BW cards — see [HQ_OPEN_QUESTIONS](HQ_OPEN_QUESTIONS.md). |

---

## P1 — Interaction / Phase 2

| ID | Question | Status | Specs |
|----|----------|--------|-------|
| **Q9** | Dependencies encoding | **Open** + **Interim** | Interim successor-list encoding via Chrome Trace `args` — [I-Q9](INTERIM_DECISIONS.md), [dependencies spec](../../specs/core/dependencies.spec.md). METRICS_AND_TRACE, INTERACTIONS, UX_SPEC, FEATURE_MATRIX, COMPONENTS |
| **Q10** | Source / Details / Cache tabs | Open | FEATURE_MATRIX, UX_SPEC, MSTT_INTEGRATION, FORMATS_COMPARISON |
| **Q11** | Roofline formulas | Open | METRICS_AND_TRACE, UI_OVERVIEW, FEATURE_MATRIX, COMPONENTS |
| **Q14** | Time units UX | **Interim** | Two-tier auto: chrome from zoom/density; tooltip/detail/Δt per-value — [I-Q14](INTERIM_DECISIONS.md). Cycles deferred. |

---

## P2 — Packaging / process

| ID | Question | Status | Specs |
|----|----------|--------|-------|
| **Q16** | Package identity | **Interim** | [PACKAGING_SUGGESTIONS](PACKAGING_SUGGESTIONS.md) / [I-Q16–19](INTERIM_DECISIONS.md) |
| **Q17** | Design system / i18n | **Interim** | same |
| **Q18** | PyPTO copy-paste license | **Interim** | same — Legal before verbatim paste |
| **Q19** | Gesture parity | **Interim** | Wheel/slider/drag MVP; W/S/A/D P2 |
| **Q21** | Acceptance owner | Open | PROJECT_GOALS, this file |

---

## Resolution log

| ID | Resolved date | Summary | Link |
|----|---------------|---------|------|
| Q1 | 2026-07-31 | Producer WIP; use sample `.rep` until format spec | REP_FORMAT |
| Q3 | 2026-07-31 | Minimal open; hide missing panels | VIEW_DATA_REQUIREMENTS |
| Q4 | 2026-07-31 | Target = sketch-like multi-core Gantt (A) | UI_OVERVIEW, METRICS gap |
| Q5 | 2026-07-31 | Hide overview until OverviewSeries (C) | VIEW_DATA_REQUIREMENTS |
| Q7 | 2026-08-20 | Hardware details source = `HardwareInfo.jsonl`; **更多** always opens — show `hardwareDetails` or **缺少 hardware info** (HQ 30–31) | VIEW_DATA_MAPPING, I-Q7a |
| Q8 | 2026-07-31 | Producer fixed naming for now (A) | METRICS_AND_TRACE |
| Q12 | 2026-07-31 | Static SVG + data-driven labels | VIEW_DATA_REQUIREMENTS |
| Q13 | 2026-07-31 | Sketch colors normative | COLOR_TOKENS |
| Q14 | 2026-07-31 | Time unit configurable | INTERACTIONS |
| Q15 | 2026-07-31 | `.json` → profiling-report | MSTT_INTEGRATION |
| Q16–Q19 | 2026-07-31 | Engineering proposals filed | PACKAGING_SUGGESTIONS |
| Interim set | 2026-07-31 | I-Q2, I-Q4, I-Q6a/b, I-Q5+, I-Q14, I-Q16–19 for MVP code | INTERIM_DECISIONS |
| Q20 | 2026-08-12 | Shared agent rules in AGENTS.md (+ nested spec guides); Cursor-only review auto-post; skills in `.agents/skills/` | AGENTS.md, CLAUDE.md |
| OPEN Q22 | 2026-08-25 | Measure mode does **not** recompute right panel / other views (local overlay only). Not HQ 22. | [INTERACTIONS](../ui/INTERACTIONS.md), [UX_SPEC](../ui/UX_SPEC.md), [VIEW_DATA_REQUIREMENTS](../formats/VIEW_DATA_REQUIREMENTS.md) |
| HQ 37 | 2026-08-28 | CSV 详情 search filters non-matching rows and highlights the matching substring (flush chip). Same on compute and memory. | [CsvFieldListPanel](../../src/ui/StatsAside/CsvFieldListPanel/CsvFieldListPanel.spec.md), [UX_SPEC](../ui/UX_SPEC.md) |
| HQ 18 | 2026-08-31 | PIPE in-bar absolute = mean non-`NA` `*_time(us)` per family/side (not cycles) | [INTERIM_DECISIONS](INTERIM_DECISIONS.md) I-Q6f, [VIEW_DATA_MAPPING](../ui/VIEW_DATA_MAPPING.md) |
| HQ 1, HQ 32 | 2026-09-01 | Duration secondary `{blockDim}/{coreCount}`; bar = `min(100%, Block Dim/core_count×100%)`; `coreCount` from HardwareInfo.jsonl by op type | [INTERIM_DECISIONS](INTERIM_DECISIONS.md) I-Q6e, [VIEW_DATA_MAPPING](../ui/VIEW_DATA_MAPPING.md) |
| HQ 2–4, Q33 | 2026-09-02 | Compute card: Cube/Vector measured/peak TFLOPS + score bar (I-Q6h interim fops/time measured) | [INTERIM_DECISIONS](INTERIM_DECISIONS.md) I-Q6h, [VIEW_DATA_MAPPING](../ui/VIEW_DATA_MAPPING.md) |
| summary-cards v930 refresh | 2026-09-04 | Sketch 2×2: AICore 并行使用率 (ex avg util); 带宽利用率 读\|写 (ex dual I/O aic\|aiv); compute Cube\|Vector | [StatsAside.spec.md](../../src/ui/StatsAside/StatsAside.spec.md), [VIEW_DATA_MAPPING](../ui/VIEW_DATA_MAPPING.md) |
| HQ obsolete (v930) | 2026-09-04 | Marked obsolete in HQ ledger: 平均核利用率 card; 启用 n/m 核; four-way 输入/输出×aic\|aiv BW layout | [HQ_OPEN_QUESTIONS](HQ_OPEN_QUESTIONS.md) Q5–10 |
