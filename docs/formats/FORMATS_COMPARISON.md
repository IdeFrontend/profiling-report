# Profiling Formats — Semantic Comparison

Compare **what data means** for OP-level profiling across: MindStudio Insight (operator path), **hardware** `.npu-rep`, **simulator** `.npu-rep`, and PyPTO swimlane inputs.

This document is **not** about binary layouts. Container hub: [INPUT_FORMATS.md](INPUT_FORMATS.md). Classic fixture: [REP_FORMAT.md](REP_FORMAT.md). Hardware embed → UI: [hardware/METRICS_AND_TRACE.md](hardware/METRICS_AND_TRACE.md). Simulator contract: [simulator/FORMAT.md](simulator/FORMAT.md).

## Scope

| In scope | Out of scope |
|----------|----------------|
| Insight **operator** profiling (Timeline / Source / Details / Cache fed by MSTT `.bin` / related op dumps) | Insight **system** profiling (host↔device training/inference timelines, cluster Summary/Communication, Ascend profiler `.db` trees) |
| `.npu-rep` **hardware** and **simulator** profiles (same container, different embeds — [PROC-7](../context/decisions/PROC.md)) | Loose MSTT CSV table preview (unchanged editor) |
| PyPTO swimlane schedule semantics (after host parse) | PyPTO compute-graph / three-column linkage payloads |

## Common semantic core

All can express, in some form:

1. **Timed activity** on AI Core / pipe-like lanes — name, start, duration
2. **Operator / kernel identity** and overall duration
3. **Pipe / unit utilization** concepts (Cube, Vector, MTE*, Scalar, …)
4. **Memory / bandwidth / cache-related** metrics (depth varies widely)
5. **Optional dependency or sync** relationships between timed units

They differ in **grain** (instruction vs task vs pipe-busy), **where aggregates live**, and **product goal**.

## Semantic matrix

| Semantic area | Insight operator (`.bin`) | `.npu-rep` **hardware** | `.npu-rep` **simulator** | PyPTO swimlane |
|---------------|---------------------------|-------------------------|--------------------------|----------------|
| **Timeline grain** | Per-**instruction** Gantt on named pipes + SET_FLAG/WAIT_FLAG | Chrome Trace → process/thread lanes (sample: pipe busy/state; product may be richer — [DATA-31](../context/questions/DATA.md)) | Emulate Chrome Trace (instr/tick events) packed as `PipeTrace.json` (**µs**, [DATA-46](../context/decisions/DATA.md)) | Process → thread → duration events; optional AICPU / counters |
| **Op / block identity** | Details base info | `OpBasicInfo.csv` (+ `Summary.jsonl`) | `KernelInfo` / emulate `summary.json` (thin Phase 1; [DATA-47](../context/questions/DATA.md)) | Light names/args |
| **Pipe utilization aggregates** | Details compute workload % | `PipeUtilization.csv` (`aic_*` / `aiv_*`) | `PipesUtilization` / hist — **not** remapped to hardware CSV ([DATA-45](../context/decisions/DATA.md)) | Event spans and/or `tilefwk_prof_pmu.csv` |
| **Arithmetic / roofline** | Compute + Roofline | `ArithmeticUtilization.csv` + Memory | ArchDiagramMetrics + Functions + VectorUtilizations + SourceInstructions (ELF often required) | Side panels if metrics fed in |
| **Memory paths** | Heatmap HBM/L2/L1/L0/UB | `Memory.csv`, `MemoryL0.csv`, `MemoryUB.csv` | Per-access `MemoryRWAccesses` (heatmap); ArchDiagram bandwidth metrics | Not core swimlane |
| **L2 cache** | Cache view | `L2Cache.csv` | Via analysis / heatmap paths as available | Optional counters |
| **Source ↔ instruction** | First-class Source heatmap | Not in sample hardware embeds | Source Assembly / AsmMetrics when ELF packed (Phase 2) | Not swimlane core |
| **Deps / sync** | SET_FLAG / WAIT_FLAG | If in trace args ([DATA-36](../context/questions/DATA.md)) | `PipeDependency` / critical path when analyzers run | Flow events / topo / deps.json |
| **Conflicts / stalls** | UB conflicts; wait cycles | `ResourceConflictRatio.csv` | UB bank / SIMD stall tables when populated | Event args / PMU |
| **Host / NPU inventory** | May appear in chrome | `HardwareInfo.jsonl` when present | Usually absent | Not typical |
| **Counters / overview** | Optional MTE-style | `Sampling.json` `ph:C` ([DATA-39](../context/decisions/DATA.md)) | Optional later (e.g. UnitUtilization → counters) | `ph:C` lanes |
| **Detection / open path** | `.bin` → Insight | `.npu-rep` leaf without sim marker | `.npu-rep` leaf + `SimulatorManifest.json` ([PROC-8](../context/decisions/PROC.md)) | Swimlane JSON / CTEF / … |
| **Adapter** | Insight server | Hardware `adaptPayloads` | `adaptSimulator` | Host / future adapter |
| **Primary product question** | “What did this kernel do on the pipes, and how does it map to source?” | “Portable OP report: summary + swimlane.” | “Cycle-accurate sim: timeline first; biprof-like deep panels Phase 2.” | “How did tasks schedule across cores?” |

## Why they differ

**Insight operator (`.bin`)**  
Single-kernel **microarchitecture** dump (PC, source, pipe Gantt, cache). Opaque; Insight + `profiler_server`.

**`.npu-rep` hardware**  
Portable **OP report pack**: pre-aggregated CSV metrics + Chrome Trace for Vue swimlane **without** Insight. Schemas: [hardware/FORMAT.md](hardware/FORMAT.md).

**`.npu-rep` simulator**  
Same **container and host extension** ([PROC-6](../context/decisions/PROC.md)), but **instruction/tick** contract from npu_emulate. Closer in grain to Insight than to hardware CSVs — yet delivered as a report pack, not `.bin`. Schemas: [simulator/FORMAT.md](simulator/FORMAT.md). **No silent remap** into hardware embeds ([DATA-45](../context/decisions/DATA.md)).

**PyPTO swimlane**  
Schedule orchestration: processes/threads/events, deps, optional AICPU/PMU. Not an Ascend OP metric CSV product.

## Overlap intent for profiling-report

```text
Insight-like microarch depth (sim Phase 2)   +   hardware OP report panels
                ↘                                      ↙
              shared Vue UI  ←  SwimlaneModel + ReportViewModel + capabilities
                ↗                                      ↖
         hardware adapter                    simulator adapter
```

- **Share:** timeline UX, summary cards when adapted fields exist, capability-gated panels.
- **Do not claim:** bit-parity with Insight Source/Cache, or that hardware and simulator metric numbers are interchangeable.
- **Sample gap (hardware):** [`data/out.rep`](../../data/out.rep) trace is pipe-state busy intervals ([DATA-31](../context/questions/DATA.md)); lane names are producer-fixed ([DATA-35](../context/decisions/DATA.md)).

## Delivery note (MSTT viewers)

```text
Performance results tree file click
  ├─ .csv          → CsvEditorProvider (raw table)
  ├─ .bin          → MindStudio Insight
  ├─ .json         → profiling-report when Chrome Trace ([PROC-3](../context/decisions/PROC.md))
  └─ .npu-rep      → profiling-report Vue panel ([PROC-2](../context/decisions/PROC.md))
                     ├─ hardware leaf  → adaptPayloads
                     └─ simulator leaf → adaptSimulator (marker [PROC-8](../context/decisions/PROC.md))
```

| Axis | Insight | Hardware `.npu-rep` | Simulator `.npu-rep` | PyPTO |
|------|---------|---------------------|----------------------|-------|
| On-disk trigger | `.bin` | `.npu-rep` | `.npu-rep` + `SimulatorManifest.json` | Swimlane JSON / CTEF / … |
| Who interprets | Insight + `profiler_server` | This library | This library | pypto host |
| Kept in MSTT? | Yes for `.bin` | Primary OP report path | Same extension | UX reference |

## Related docs

- [INPUT_FORMATS.md](INPUT_FORMATS.md) — container hub + profiles
- [hardware/FORMAT.md](hardware/FORMAT.md) · [simulator/FORMAT.md](simulator/FORMAT.md)
- [ADAPTERS.md](ADAPTERS.md) — detect → adapt → view-models
- [VIEW_DATA_REQUIREMENTS.md](VIEW_DATA_REQUIREMENTS.md) — adapted VM hide rules
- [DOMAIN_AND_USERS.md](../context/DOMAIN_AND_USERS.md)
- [questions](../context/questions/) — PROC-9, DATA-47, …
