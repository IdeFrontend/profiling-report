# Emulate table inventory

**Profile:** `emulate` (npu_emulate contract SQLite / CSV export).

Scoped catalog for profiling-report consumers. Full contract DB is **100 tables + 22 views** (`total_objects=122`). This doc lists **pack status** and Phase 1 / product surfaces.

**Column names, SQL types, and field descriptions:** see **[SCHEMA.md](SCHEMA.md)** (SSOT from [`data/gelu/manifest.json`](../../../data/gelu/manifest.json)).

Contract + leaf pack: [FORMAT.md](FORMAT.md). Sample: [`data/gelu.npu-rep`](../../../data/gelu.npu-rep), unpacked [`data/gelu/`](../../../data/gelu/), notes [`data/gelu.README.md`](../../../data/gelu.README.md).

## Sample provenance (gelu)

| Field | Value |
|-------|--------|
| Source DB | `0000_gelu_npu_emulated.db` |
| Exported | `2026-09-15T08:04:27.476042+00:00` |
| `total_objects` / tables / views | 122 / 100 / 22 |
| `total_rows` (all objects) | 169435 |
| Leaf embeds | `manifest.json` + **34** populated CSVs + `PipeTrace.json` (+ `aicore_utilization.json`, `core_0_critical_path_report_0.json`) |
| Export catalog | `manifest.json` — `{ database, exported_at, total_*, objects[] }` with per-object `name`, `type`, `row_count`, `columns`, `file` |

**Export catalog marker.** `manifest.json` **is** the emulate detection signal ([PROC-8](../../context/decisions/PROC.md)): export-catalog shape or thin `{ profile: "emulate", schemaVersion }`. Timeline uses normative **`PipeTrace.json`**.

---

## 1. Packed embeds in `gelu.npu-rep` (34 CSVs)

Row counts are data rows (header excluded). Object names match the manifest; link → SCHEMA for full columns.

| Table / view | Kind | Rows | Notes |
|---|---|---:|---|
| [`MemoryRWAccesses`](SCHEMA.md#memoryrwaccesses) | table | 34832 | Memory heatmap |
| [`UbRwAccesses`](SCHEMA.md#ubrwaccesses) | table | 34832 | UB address accesses |
| [`SharedPatterns`](SCHEMA.md#sharedpatterns) | view | 34832 | Instr + shared address patterns |
| [`CCUAllTickEvents`](SCHEMA.md#ccualltickevents) | table | 18131 | CCU tick stream |
| [`VfPMUValues`](SCHEMA.md#vfpmuvalues) | table | 6880 | Per-VF PMU samples |
| [`VfPMUDeltasViewPerVf`](SCHEMA.md#vfpmudeltasviewpervf) | view | 6880 | Per-VF PMU deltas |
| [`ExecutedInstructions`](SCHEMA.md#executedinstructions) | table | 6031 | Hub; 16 columns incl. wait/sync/VF class flags |
| [`IPCAsmMetrics`](SCHEMA.md#ipcasmmetrics) | view | 5381 | Per-instr IPC components |
| [`DispatchTime`](SCHEMA.md#dispatchtime) | table | 4265 | Chrome Trace dispatch |
| [`ScalarIpcDynamic`](SCHEMA.md#scalaripcdynamic) | table | 4133 | Dynamic scalar IPC |
| [`ICacheEvents`](SCHEMA.md#icacheevents) | table | 2547 | ICache tracing |
| [`SprInfoPerInstr`](SCHEMA.md#sprinfoperinstr) | table | 2014 | SPR values per instr |
| [`VfIPCDynamic`](SCHEMA.md#vfipcdynamic) | table | 1216 | Windowed VF IPC |
| [`VfIPCInside`](SCHEMA.md#vfipcinside) | table | 1216 | In-VF IPC |
| [`VfIPCDynamicView`](SCHEMA.md#vfipcdynamicview) | view | 1216 | Windowed VF IPC by core |
| [`UnitsUsageMetrics`](SCHEMA.md#unitsusagemetrics) | table | 924 | Sub-core / warp usage |
| [`UnitUtilization`](SCHEMA.md#unitutilization) | table | 736 | Unit util time series |
| [`PredicateRegValues`](SCHEMA.md#predicateregvalues) | table | 640 | Predicate registers |
| [`VectorUtilizations`](SCHEMA.md#vectorutilizations) | table | 480 | Roofline-style vector util |
| [`VfPMUViewPerSubcore`](SCHEMA.md#vfpmuviewpersubcore) | view | 430 | PMU by subcore |
| [`SprWriteEvents`](SCHEMA.md#sprwriteevents) | table | 350 | SPR writes |
| [`SIMDSamplingStats`](SCHEMA.md#simdsamplingstats) | table | 256 | SIMD stall samples |
| [`VfPMUMetrics`](SCHEMA.md#vfpmumetrics) | table | 215 | PMU metric dictionary |
| [`PMUScalarCounters`](SCHEMA.md#pmuscalarcounters) | table | 141 | Scalar PMU counters |
| [`ArchDiagramMetrics`](SCHEMA.md#archdiagrammetrics) | table | 120 | Architecture diagram params |
| [`ExecQueueUtilization`](SCHEMA.md#execqueueutilization) | table | 72 | Exec queue util |
| [`IssueQueueUtilization`](SCHEMA.md#issuequeueutilization) | table | 72 | Issue queue util |
| [`BrifEvents`](SCHEMA.md#brifevents) | table | 64 | BRIF events |
| [`CriticalPath`](SCHEMA.md#criticalpath) | table | 60 | Critical path links |
| [`AnalysisState`](SCHEMA.md#analysisstate) | table | 33 | Which analyzers ran |
| [`DmaMovProcessedBytes`](SCHEMA.md#dmamovprocessedbytes) | table | 32 | DMA traffic |
| [`DmaMovSimpleParams`](SCHEMA.md#dmamovsimpleparams) | table | 32 | Simple DMA params |
| [`VfIPC`](SCHEMA.md#vfipc) | table | 32 | VF IPC aggregates |
| [`PipeDependency`](SCHEMA.md#pipedependency) | table | 30 | Pipe dependency flows |

Plus leaf JSON (not contract tables): `PipeTrace.json`, `aicore_utilization.json`, `core_0_critical_path_report_0.json`, `manifest.json`.

---

## 2. Phase 1 + product UI (MHTML §11.2.3) + tracing — pack status on gelu

| Table / view | Kind | DB rows | In gelu pack? | Used for |
|---|---|---:|---|---|
| [`KernelInfo`](SCHEMA.md#kernelinfo) | table | 17 | **no** | Phase 1 thin summary / identity |
| [`ExecutedInstructions`](SCHEMA.md#executedinstructions) | table | 6031 | yes | Hub; tracing; arch; roofline |
| [`ArchDiagramMetrics`](SCHEMA.md#archdiagrammetrics) | table | 120 | yes | Architecture Diagram |
| [`MemoryRWAccesses`](SCHEMA.md#memoryrwaccesses) | table | 34832 | yes | Memory heatmap |
| [`AiCoreOccupancy`](SCHEMA.md#aicoreoccupancy) | view | 3 | **no** | AICore utilization overlay |
| [`PipesUtilization`](SCHEMA.md#pipesutilization) | table | 24 | **no** | PIPE occupancy / CSV tab |
| [`PipeUtilizationHist`](SCHEMA.md#pipeutilizationhist) | view | 24 | **no** | Util hist |
| [`Functions`](SCHEMA.md#functions) | table | 0 | no (empty) | Roofline VF names (ELF) |
| [`VectorUtilizations`](SCHEMA.md#vectorutilizations) | table | 480 | yes | Roofline |
| [`SourceInstructions`](SCHEMA.md#sourceinstructions) | table | 0 | no (empty) | Roofline / source join |
| [`VfIPC`](SCHEMA.md#vfipc) | table | 32 | yes | SIMD/SIMT VF IPC |
| [`VfSimtIPC`](SCHEMA.md#vfsimtipc) | table | 0 | no (empty) | needs SIMT IPC path |
| Call* / [`CallGraph`](SCHEMA.md#callgraph) … | table | 0 | no (empty) | Call stacks (ELF) |
| [`DispatchTime`](SCHEMA.md#dispatchtime) | table | 4265 | yes | Chrome Trace |
| [`InstrTypes`](SCHEMA.md#instrtypes) | table | 15 | **no** | Instruction type names |
| [`CoreTypes`](SCHEMA.md#coretypes) | table | 3 | **no** | Core type names |
| [`PipeDependency`](SCHEMA.md#pipedependency) | table | 30 | yes | Chrome Trace flows |
| [`ICacheEvents`](SCHEMA.md#icacheevents) | table | 2547 | yes | Chrome Trace ICache |
| [`ICacheRefillEvents`](SCHEMA.md#icacherefillevents) | table | 11 | **no** | |
| [`QueueFullEvents`](SCHEMA.md#queuefullevents) | table | 0 | no (empty) | |
| [`UnitUtilization`](SCHEMA.md#unitutilization) | table | 736 | yes | |
| [`IssueQueueUtilization`](SCHEMA.md#issuequeueutilization) / [`ExecQueueUtilization`](SCHEMA.md#execqueueutilization) | table | 72 | yes | |

---

## 3. Populated in DB but **not** packed into gelu leaf

Export packer skipped these despite `row_count > 0`. Packers aiming at Sept 30 / MHTML surfaces should **not** assume “present in DB ⇒ present in `.npu-rep`”.

| Name | Kind | Rows |
|---|---|---:|
| [`InstrNameHistClocks`](SCHEMA.md#instrnamehistclocks) | view | 57 |
| [`InstrNameHistCount`](SCHEMA.md#instrnamehistcount) | view | 57 |
| [`VfPMUSummary`](SCHEMA.md#vfpmusummary) | table | 32 |
| [`PipesUtilization`](SCHEMA.md#pipesutilization) | table | 24 |
| [`PipeUtilizationHist`](SCHEMA.md#pipeutilizationhist) | view | 24 |
| [`KernelInfo`](SCHEMA.md#kernelinfo) | table | 17 |
| [`InstrTypes`](SCHEMA.md#instrtypes) | table | 15 |
| [`ActiveInstrTypes`](SCHEMA.md#activeinstrtypes) | view | 12 |
| [`InstrTypeHistClocks`](SCHEMA.md#instrtypehistclocks) | view | 12 |
| [`InstrTypeHistCount`](SCHEMA.md#instrtypehistcount) | view | 12 |
| [`HintTypes`](SCHEMA.md#hinttypes) | table | 11 |
| [`ICacheRefillEvents`](SCHEMA.md#icacherefillevents) | table | 11 |
| [`InstrQueueTypes`](SCHEMA.md#instrqueuetypes) | table | 9 |
| [`SIMDStallsByAddr`](SCHEMA.md#simdstallsbyaddr) | table | 8 |
| [`CoreTypes`](SCHEMA.md#coretypes) | table | 3 |
| [`ICacheStartingPCs`](SCHEMA.md#icachestartingpcs) | table | 3 |
| [`AiCoreOccupancy`](SCHEMA.md#aicoreoccupancy) | view | 3 |

---

## 4. Empty-but-schema-important (often flag / ELF gated)

71 objects have `row_count=0` in gelu (not packed). Notable:

| Name | Notes |
|---|---|
| [`SourceFiles`](SCHEMA.md#sourcefiles) / [`SourceLines`](SCHEMA.md#sourcelines) / [`DebugInfo`](SCHEMA.md#debuginfo) / [`BasicBlocks`](SCHEMA.md#basicblocks) / [`Functions`](SCHEMA.md#functions) | ELF / `--object-file` |
| [`TraceBubbles`](SCHEMA.md#tracebubbles) / [`TraceBubbleSummary`](SCHEMA.md#tracebubblesummary) | `--bubble` |
| [`VfSimtIPC`](SCHEMA.md#vfsimtipc)* / [`VfSimtInvocations`](SCHEMA.md#vfsimtinvocations) | SIMT IPC path |
| Call* | Call stacks (ELF) |
| [`MemoryUtilizationStates`](SCHEMA.md#memoryutilizationstates) | `--memory-utilization` |
| [`DCacheHitMissEvents`](SCHEMA.md#dcachehitmissevents) | quantitative indices |
| [`QueueFullEvents`](SCHEMA.md#queuefullevents) / [`QueueFullStalls`](SCHEMA.md#queuefullstalls) | not triggered on gelu |

Full empty list: `data/gelu/manifest.json` → `objects` where `row_count == 0` (also enumerated in [SCHEMA.md](SCHEMA.md)).

---

## 5. `AnalysisState` on gelu (analyzers that ran)

See [`AnalysisState`](SCHEMA.md#analysisstate). All rows `AnalysisPassed=1` except `ascend950_pipe_dependency_buffers=0`. Passed includes pipe utilization/dependency, arch_diagram, vf_ipc, scalar_ipc (+ dynamic), unit/subqueue utilization, simd sampling, **critical_path**, vector_utilization, dma_mov*, mmad, fixp, region_tracing, …

---

## 6. Older transfer sample

Pre-gelu inventory used export `2026-09-09` (`total_rows=67067`). Prefer **gelu** row counts and pack membership above when documenting what lands in a producer `.npu-rep`.
