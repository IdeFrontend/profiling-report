# Profiling Formats — Semantic Comparison

Compare **what data means** for OP-level profiling across three stacks: MindStudio Insight (operator path), the new **`.rep` / `.ncrep`** report pack, and PyPTO swimlane inputs.

This document is **not** about binary layouts. Container packing for `.rep` lives in [REP_FORMAT.md](REP_FORMAT.md). Embed → UI field mapping lives in [METRICS_AND_TRACE.md](METRICS_AND_TRACE.md).

## Scope

| In scope | Out of scope |
|----------|----------------|
| Insight **operator** profiling (Timeline / Source / Details / Cache fed by MSTT `.bin` / related op dumps) | Insight **system** profiling (host↔device training/inference timelines, cluster Summary/Communication, Ascend profiler `.db` trees) |
| `.rep` / `.ncrep` OP report semantics (metric CSVs + Chrome Trace) | Loose MSTT CSV table preview (unchanged editor) |
| PyPTO swimlane schedule semantics (after host parse) | PyPTO compute-graph / three-column linkage payloads |

## Common semantic core

All three can express, in some form:

1. **Timed activity** on AI Core / pipe-like lanes — name, start, duration
2. **Operator / kernel identity** and overall duration
3. **Pipe / unit utilization** concepts (Cube, Vector, MTE*, Scalar, …)
4. **Memory / bandwidth / cache-related** metrics (depth varies widely)
5. **Optional dependency or sync** relationships between timed units

They differ in **grain** (instruction vs task vs pipe-busy), **where aggregates live** (opaque BIN vs CSV pack vs side PMU), and **product goal** (microarchitecture debug vs portable report vs schedule orchestration).

## Semantic matrix

| Semantic area | Insight operator (`.bin` path) | `.rep` / `.ncrep` | PyPTO swimlane |
|---------------|--------------------------------|------------------|----------------|
| **Timeline grain** | Per-**instruction** Gantt on named pipes (SCALAR, FLOWCTRL, MTE1–3, CUBE, VECTOR, FIXP, CACHEMISS, …) plus SET_FLAG ↔ WAIT_FLAG sync edges | Chrome Trace → process / thread lanes. Sample fixture: **pipe busy/state** intervals on AIV pipes. Product traces may be richer (multi-core instruction-like lanes — see [OPEN_QUESTIONS](../context/OPEN_QUESTIONS.md) Q4) | Process → thread → **duration events** (ops/tasks); optional AICPU E2E (scheduler / orchestrator) and counter lanes |
| **Op / block identity** | Details “base info”: op name, type (`vector`/`cube`/`mix`), duration, block dim, per-block times | `OpBasicInfo.csv` | Usually light: names / args (`seqNo`, `taskId`, hints); no dedicated op-summary CSV |
| **Pipe utilization aggregates** | Details compute workload: cycles% by pipe/instruction; timeline shows occupancy visually | `PipeUtilization.csv` (`aic_*` / `aiv_*` ratios, MTE, scalar stalls, i-cache, …) | Derived from event spans and/or joined **`tilefwk_prof_pmu.csv`** — not the Ascend OP CSV pack |
| **Arithmetic / roofline** | Compute workload + Roofline (intensity vs TOPS, memory/transfer ceilings) | `ArithmeticUtilization.csv` (+ Roofline UI later) | Performance side panels only if metrics are fed into the model |
| **Memory paths** | Memory heatmap: HBM/L2/L1/L0/UB requests, BW, hit rates, peak % of theoretical | `Memory.csv`, `MemoryL0.csv`, `MemoryUB.csv` | Not core swimlane payload |
| **L2 cache** | Dedicated Cache view (line hit/miss) linked to Source | `L2Cache.csv` (Phase 2+ UI) | Optional counters / PMU-like fields |
| **Source ↔ instruction** | First-class Source heatmap (line ↔ insn, PC, cycles, conflicts) | **Not** in sample embeds | Not swimlane core (may jump to compute graph via hashes) |
| **Deps / sync** | SET_FLAG / WAIT_FLAG between pipes | Only if encoded in `trace.json` args or side embeds ([Q9](../context/OPEN_QUESTIONS.md)) | Flow events (`s`/`f`), `dyn_topo.txt`, and/or `deps.json` |
| **Conflicts / stalls** | Source UB conflicts; wait cycles in Details | `ResourceConflictRatio.csv` (Phase 2+) | Stall/conflict if present in event args or PMU |
| **Host / NPU inventory** | May appear in Insight detail chrome | Not in sample `.rep` ([Q7](../context/OPEN_QUESTIONS.md)) | Not typical |
| **Counters / step metrics** | Optional MTE throughput-style counters on Timeline | Not first-class in sample (overview charts data source open — [Q5](../context/OPEN_QUESTIONS.md)) | Chrome Trace `ph: C` lanes (e.g. ready counts, mem usage) |
| **Primary product question** | “What did this kernel do on the pipes, and how does it map to source?” | “Give me a portable OP report: summary panels + a swimlane-friendly timeline.” | “How did tasks schedule across cores (and AICPU), with deps and optional PMU?” |

## Why they differ

**Insight operator (`.bin`)**  
Built for **single-kernel microarchitecture** analysis. The dump is rich enough for instruction PC, source mapping, pipe Gantt, cache-line events, and roofline. MSTT does not interpret the payload; Insight’s server does. That depth is why the format stays opaque and tied to the Insight stack.

**`.rep` / `.ncrep`**  
Built as a **portable report pack**: pre-aggregated **CSV metrics** for summary / PIPE / memory / cache panels, plus a **Chrome Trace** timeline so a Vue library can render a pypto-like swimlane **without** Insight or `profiler_server`. Semantics intentionally overlap Insight’s *report* surfaces (util, memory, op info, timed lanes), not necessarily Insight’s full instruction/Source/Cache event graphs unless embeds grow.

**PyPTO swimlane**  
Built for **schedule orchestration**: processes/threads/events, dependencies, optional AICPU stack, counter tracks, and optional per-task PMU join. It is format-agnostic after parse (Chrome Trace, PerfSwim, MsProf-style JSON). It is **not** an Ascend OP “metric CSV product”; those aggregates are absent unless supplied as side files or event args.

## Overlap intent for profiling-report

```text
Insight operator report semantics  +  PyPTO-like timeline UX
                ↘                      ↙
                 .rep  →  Vue library
```

Semantic **overlap** (timed lanes, pipe util concepts, op identity) justifies a **shared Vue swimlane/report UI**. Semantic **differences** (instruction vs task vs pipe-busy grain; CSV packs vs schedule/PMU side files; Insight Source/Cache depth) justify **per-format adapters** into canonical models — not merging all on-disk formats into one uber component. Architecture: [ARCHITECTURE.md](../architecture/ARCHITECTURE.md) (shared UI + adapters).

- **Aim to cover:** op identity, pipe utilization aggregates, memory/L2 aggregates, timed lane activity for a swimlane UI.
- **Do not claim by default:** bit-parity with Insight instruction-level Source/Cache graphs or PyPTO AICPU/Mix/wrap schedule features.
- **Sample gap:** current [`data/out.rep`](../../data/out.rep) `trace.json` is pipe-state busy intervals, thinner than product **target** (sketch-like multi-core instruction Gantt — [Q4](../context/OPEN_QUESTIONS.md)). Use sample until a sketch-faithful golden arrives; lane naming follows **producer fixed names** ([Q8](../context/OPEN_QUESTIONS.md)).

## Delivery note (MSTT viewers)

Semantic payloads above are delivered differently in MSTT:

```text
Performance results tree file click
  ├─ .csv          → CsvEditorProvider (raw table; not this comparison)
  ├─ .bin          → MindStudio Insight (operator semantics above)
  ├─ .json         → profiling-report when Chrome Trace ([Q15](../context/OPEN_QUESTIONS.md))
  └─ .rep / .ncrep → profiling-report Vue panel
```

`.rep` and `.ncrep` share the same container semantics (**Interim [I-Q2](../context/INTERIM_DECISIONS.md)** — product alias until divergence is defined). Binary layout: [REP_FORMAT.md](REP_FORMAT.md).

| Axis | Insight operator | `.rep` / profiling-report | PyPTO swimlane |
|------|------------------|---------------------------|----------------|
| Typical on-disk trigger | `.bin` (+ Insight JSON/DB for other modes) | `.rep` / `.ncrep` container | Swimlane JSON / Chrome Trace / `perf_swimlane` (+ optional PMU/topo) |
| Who interprets | Insight SPA + `profiler_server` | This Vue library | pypto_toolkit host + swimGraph |
| Kept in MSTT? | Yes for `.bin` | Primary new OP report path | Not used by MSTT today (UX/code reference) |

## Related docs

- [DOMAIN_AND_USERS.md](../context/DOMAIN_AND_USERS.md) — OP developer context, pain points, glossary
- [VIEW_DATA_REQUIREMENTS.md](VIEW_DATA_REQUIREMENTS.md) — per-view required inputs / hide rules
- [REP_FORMAT.md](REP_FORMAT.md) — container binary layout
- [METRICS_AND_TRACE.md](METRICS_AND_TRACE.md) — `.rep` embeds → UI panels
- [OPEN_QUESTIONS.md](../context/OPEN_QUESTIONS.md) — remaining blockers (esp. Q6)
- [SWIMLANE_IMPLEMENTATIONS.md](../archive/research/SWIMLANE_IMPLEMENTATIONS.md) — renderer tech, not data semantics
