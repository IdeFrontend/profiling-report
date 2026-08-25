# Open Questions Before Complete Specs

Status values: **Open** | **Proposed** | **Resolved** | **Interim** (engineering default — see [INTERIM_DECISIONS.md](INTERIM_DECISIONS.md); not Product-final).

Answers must update the relevant specs ([REP_FORMAT](../formats/REP_FORMAT.md), [METRICS_AND_TRACE](../formats/METRICS_AND_TRACE.md), [VIEW_DATA_REQUIREMENTS](../formats/VIEW_DATA_REQUIREMENTS.md), [FEATURE_MATRIX](../ui/FEATURE_MATRIX.md), [UX_SPEC](../ui/UX_SPEC.md), [COMPONENTS](../architecture/COMPONENTS.md), etc.). Do not leave permanent TBDs only in code.

**When resolved:** remove the row from the tables below and write the decision into those specs in the **same change**. Optional one-line entry in the resolution log. Process: [DEVELOPMENT.md § Resolving open questions](../process/DEVELOPMENT.md#resolving-open-questions).

## Why Product-complete specs are still incomplete

Producer **format/data specification is still forthcoming**. Product has answered many P0 items; remaining Product gaps (especially **Q6 formulas** and a **sketch-faithful golden**) are covered by **Interim** defaults so MVP coding can start.

**MVP unblock doc:** [INTERIM_DECISIONS.md](INTERIM_DECISIONS.md)

**Right-panel field / UX ledger:** [HQ_OPEN_QUESTIONS.md](HQ_OPEN_QUESTIONS.md) (HQ DATA 1–29, HQ UI/UX 30–36). Those HQ numbers are not the Q1–Q23 ids in the tables below.

## What you can do now

- Implement per [INTERIM_DECISIONS](INTERIM_DECISIONS.md) + [VIEW_DATA_REQUIREMENTS](../formats/VIEW_DATA_REQUIREMENTS.md)
- Timeline with minimal data; hide panels without inputs (Q3)
- Hide overview charts (Q5 / I-Q5+)
- Thin summary + PIPE mean aggregation (I-Q6a / I-Q6b); I/O BW cards (I-Q6g)
- Fixture `data/out.rep` for CI (I-Q4); colors [COLOR_TOKENS](../ui/COLOR_TOKENS.md)
- Open Chrome Trace `.json` in profiling-report (Q15)
- Packaging scaffold per [PACKAGING_SUGGESTIONS](PACKAGING_SUGGESTIONS.md) (I-Q16–19)

## Still blocking Product-final (not coding) acceptance

- Exact summary tile formulas (Q6) — measured I/O BW confirmed; peak/score still guessed; compute / avg util shown as **N/A** placeholders until formulas land
- Production-like multi-core instruction golden (Q4 target) — interim uses `out.rep`
- Overview chart producer — interim keeps charts hidden
- Phase 2 contracts Q9–Q11, Q10
- Measure-range cross-view sync (Q22)
- Multi-select Self time data source (Q23)
- Context menu: 翻屏播放 semantics + Ctrl+Z conflict (Q24), Offset contract (Q25), 置顶显示 vs Pin row (Q26)

---

## P0 — Format + MVP UI

| ID | Question | Status | Specs / notes |
|----|----------|--------|---------------|
| **Q1** | Producer of `.rep` / `.ncrep` | **Resolved** | Tool WIP. Sample `.rep` + [REP_FORMAT](../formats/REP_FORMAT.md) until producer spec. |
| **Q2** | `.ncrep` vs `.rep` | **Interim** | Same layout/alias — [I-Q2](INTERIM_DECISIONS.md). |
| **Q3** | Required embeds / missing data | **Resolved** | Minimal open; **hide** missing panels. → [VIEW_DATA_REQUIREMENTS](../formats/VIEW_DATA_REQUIREMENTS.md) |
| **Q4** | Authoritative MVP fixture shape | **Resolved (target)** + **Interim (fixture)** | Product target = sketch-like Gantt (A). **CI fixture** = `out.rep` until golden — [I-Q4](INTERIM_DECISIONS.md). |
| **Q5** | Overview charts data source | **Resolved** | **Hide** until `OverviewSeries` (C). Adapter `[]` — [I-Q5+](INTERIM_DECISIONS.md). |
| **Q6** | Report summary formulas | **Interim** | **Confirmed (npu-compute 0818):** duration = `OpBasicInfo.csv` `Task Duration(us)`; I/O **measured** = `Memory.csv` `ai*_main_mem_{read\|write}_bw`; I/O display **GB/s** (HQ 34). Compute TFLOPS and avg core util stay in the sketch grid as **title + `N/A`** until formulas exist ([I-Q6a](INTERIM_DECISIONS.md)). PIPE = mean non-`NA` — [I-Q6b](INTERIM_DECISIONS.md). MIX Cube\|Vector + ICache Miss rows confirmed. **Open:** bandwidth **peak / score** (I-Q6g guess 1600 GB/s; sketch 81 ≠ ratio), `block_id` mean vs max vs selected block. |
| **Q7** | Hardware details sidebar | **Resolved (source)** + **HQ 30–31** | **`HardwareInfo.jsonl`** is the details source (npu-compute 0818). Not required to open Timeline; **更多** always opens overlay — show `hardwareDetails` when present, else **缺少 hardware info** ([I-Q7a](INTERIM_DECISIONS.md)). Aside meta is **进程** / **算子类型** / **Blocks** (`Pid` / `Op Type` / `Block Dim`). |
| **Q8** | Lane hierarchy mapping | **Resolved (interim naming)** | Producer/stress fixed naming (A); no viewer heuristics inventing Card/Core from AIV pipes. Nested gutter renders explicit `children` (sketch Card tree). |

---

## P1 — Interaction / Phase 2

| ID | Question | Status | Specs |
|----|----------|--------|-------|
| **Q9** | Dependencies encoding | **Open** + **Interim** | Interim successor-list encoding via Chrome Trace `args` — [I-Q9](INTERIM_DECISIONS.md), [dependencies spec](../../specs/core/dependencies.spec.md). METRICS_AND_TRACE, INTERACTIONS, UX_SPEC, FEATURE_MATRIX, COMPONENTS |
| **Q10** | Source / Details / Cache tabs | Open | FEATURE_MATRIX, UX_SPEC, MSTT_INTEGRATION, FORMATS_COMPARISON |
| **Q11** | Roofline formulas | Open | METRICS_AND_TRACE, UI_OVERVIEW, FEATURE_MATRIX, COMPONENTS |
| **Q12** | Memory topology | **Resolved** | Static SVG + data-driven edge labels. |
| **Q13** | Color / category legend | **Resolved** | [COLOR_TOKENS.md](../ui/COLOR_TOKENS.md) |
| **Q14** | Time units UX | **Resolved (partial)** + **Interim (auto time)** | Two-tier auto: chrome from zoom/density; tooltip/detail/Δt per-value — [I-Q14](INTERIM_DECISIONS.md). Cycles deferred. |
| **Q15** | MSTT `.json` policy | **Resolved** | Chrome Trace `.json` → profiling-report. |
| **Q22** | Time-range measure / multi-select → which views? | **Open** | When timeline **度量模式** sets `measureRange [t0,t1]` ([`v930/task-measure-mode`](../ui/source/v930/task-measure-mode.jpeg)), or marquee multi-select picks N events ([`v930/task-marquee`](../ui/source/v930/task-marquee.jpeg)), which views must update? Candidates: PIPE / Cube·Vector bars; compute-load detail tabs; memory detail tabs + topology; report summary; detail strip; overview charts (if present). Distinct from overview brush (`timeWindow`) and event selection. Until answered: measure UI is **local overlay only** (band + Δt; no aside recompute); multi-select is **local panel only** (table, no aside recompute). Specs when answered: UX_SPEC sync, INTERACTIONS, FEATURE_MATRIX, COMPONENTS, view-state / StatsAside, [MultiSelectSummary](../../src/ui/MultiSelectSummary/MultiSelectSummary.spec.md). |
| **Q23** | Multi-select Self time data source | **Open** | The sketch shows Self time = Wall Duration for every event (flat events, no parent/child nesting). Does the producer plan to emit a per-event `selfTime` field (e.g. in Chrome Trace `args.selfTime`)? Until answered: Self time column = `event.duration`. Specs when answered: [METRICS_AND_TRACE](../formats/METRICS_AND_TRACE.md), [MultiSelectSummary](../../src/ui/MultiSelectSummary/MultiSelectSummary.spec.md). |
| **Q24** | 翻屏播放 (Scroll playback) semantics | **Open** | Sketch `v930/task-context-menu` shows shortcut Ctrl+Z (collides with undo). What does the action do — auto-scroll the timeline one screen width at playback speed, or jump to next event? Is Ctrl+Z the real binding? Until answered: **omit from MVP context menu**. Specs when answered: [ContextMenu](../../src/ui/ContextMenu/ContextMenu.spec.md), INTERACTIONS, UX_SPEC. |
| **Q25** | Offset action contract | **Open** | Context menu item "Offset" on lane right-click (`v930/task-context-menu`). Does it open a numeric input dialog for manual Δt entry, or apply an auto-calculated offset (align lane start to t=0)? No sub-menu arrow in the sketch suggests a single click. Until answered: **omit from MVP context menu**. Specs when answered: [ContextMenu](../../src/ui/ContextMenu/ContextMenu.spec.md), INTERACTIONS. |
| **Q26** | 置顶显示 vs Pin row distinction | **Open** | Sketch shows both 置顶显示 (Pin to top, event-scope) and Pin row (Ctrl+P, lane-scope). 置顶显示 pins a single event to the top of its lane? Or pins the lane like Pin row but scoped to the event's card? Clarify the two pinning semantics. Until answered: **implement Pin row only** (lane pinning is unambiguous); 置顶显示 is not rendered in the MVP menu, so the two pinning paths cannot diverge before Product clarifies. Specs when answered: [ContextMenu](../../src/ui/ContextMenu/ContextMenu.spec.md), UX_SPEC. |

---

## P2 — Packaging / process

| ID | Question | Status | Specs |
|----|----------|--------|-------|
| **Q16** | Package identity | **Interim** | [PACKAGING_SUGGESTIONS](PACKAGING_SUGGESTIONS.md) / [I-Q16–19](INTERIM_DECISIONS.md) |
| **Q17** | Design system / i18n | **Interim** | same |
| **Q18** | PyPTO copy-paste license | **Interim** | same — Legal before verbatim paste |
| **Q19** | Gesture parity | **Interim** | Wheel/slider/drag MVP; W/S/A/D P2 |
| **Q20** | Cursor skills / agent rules | **Resolved** | Shared: [`AGENTS.md`](../../AGENTS.md), nested `specs/AGENTS.md` (Claude: `specs/CLAUDE.md` → `@./AGENTS.md`), skills in `.agents/skills/`. Cursor-only: `.cursor/rules/code-review-post-github.mdc`. Root Claude: [`CLAUDE.md`](../../CLAUDE.md) → `@AGENTS.md`. |
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
