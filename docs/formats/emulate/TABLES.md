# Emulate table inventory

**Profile:** `emulate` (npu_emulate contract SQLite / CSV export).

Scoped catalog for profiling-report consumers. Full contract DB is **100 tables + 22 views** (`total_objects=122`). This doc lists **pack status** and Phase 1 / product surfaces.

**Column names, SQL types, and field descriptions:** see **[SCHEMA.md](SCHEMA.md)** (SSOT = `manifest.json` inside [`data/gelu.npu-rep`](../../../data/gelu.npu-rep)).

Contract + leaf pack: [FORMAT.md](FORMAT.md). Sample: [`data/gelu.npu-rep`](../../../data/gelu.npu-rep), notes [`data/gelu.README.md`](../../../data/gelu.README.md). Unpack locally with `data/scripts/unpack_rep.py` when inspecting CSVs.

## Sample provenance (gelu)

| Field | Value |
|-------|--------|
| Source DB | `0000_gelu_npu_emulated.db` |
| Exported | `2026-09-21T12:05:51.821657+00:00` |
| `total_objects` / tables / views | 124 / 101 / 23 |
| `total_rows` (all objects) | 161314 |
| Leaf embeds | `manifest.json` + **53** CSVs + `core_0_tracing_report_0.json` (+ `aicore_utilization.json`) |
| Export catalog | `manifest.json` — `{ database, exported_at, total_*, objects[] }` with per-object `name`, `type`, `row_count`, `columns`, `file` |

**Export catalog marker.** `manifest.json` **is** the emulate detection signal ([PROC-8](../../context/decisions/PROC.md)): export-catalog shape or thin `{ profile: "emulate", schemaVersion }`. Timeline accepts producer `core_*_tracing_report_*.json` or normative **`PipeTrace.json`**.

---

## 1. Packed embeds in `gelu.npu-rep` (53 CSVs)

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
| [`DispatchTime`](SCHEMA.md#dispatchtime) | table | 4265 | Chrome Trace dispatch |
| [`ICacheEvents`](SCHEMA.md#icacheevents) | table | 2547 | ICache tracing |
| [`SprInfoPerInstr`](SCHEMA.md#sprinfoperinstr) | table | 2014 | SPR values per instr |
| [`IPCAsmMetrics`](SCHEMA.md#ipcasmmetrics) | view | 1248 | Per-instr IPC components |
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
| [`ArchDiagramMetrics`](SCHEMA.md#archdiagrammetrics) | table | 240 | Architecture diagram params |
| [`VfPMUMetrics`](SCHEMA.md#vfpmumetrics) | table | 215 | PMU metric dictionary |
| [`PMUScalarCounters`](SCHEMA.md#pmuscalarcounters) | table | 141 | Scalar PMU counters |
| [`PipeDependency`](SCHEMA.md#pipedependency) | table | 118 | Pipe dependency flows |
| [`ExecQueueUtilization`](SCHEMA.md#execqueueutilization) | table | 72 | Exec queue util |
| [`IssueQueueUtilization`](SCHEMA.md#issuequeueutilization) | table | 72 | Issue queue util |
| [`BrifEvents`](SCHEMA.md#brifevents) | table | 64 | BRIF events |
| [`InstrNameHistClocks`](SCHEMA.md#instrnamehistclocks) | view | 57 | |
| [`InstrNameHistCount`](SCHEMA.md#instrnamehistcount) | view | 57 | |
| [`DmaMovProcessedBytes`](SCHEMA.md#dmamovprocessedbytes) | table | 32 | DMA traffic |
| [`DmaMovSimpleParams`](SCHEMA.md#dmamovsimpleparams) | table | 32 | Simple DMA params |
| [`VfIPC`](SCHEMA.md#vfipc) | table | 32 | VF IPC aggregates |
| [`VfPMUSummary`](SCHEMA.md#vfpmusummary) | table | 32 | |
| [`AnalysisState`](SCHEMA.md#analysisstate) | table | 31 | Which analyzers ran |
| [`InstructionHints`](SCHEMA.md#instructionhints) | table | 25 | Performance hints per PC (manifest `row_count` 0) |
| [`PipesUtilization`](SCHEMA.md#pipesutilization) | table | 24 | PIPE occupancy |
| [`PipeUtilizationHist`](SCHEMA.md#pipeutilizationhist) | view | 24 | PIPE hist (preferred for bars) |
| [`SourceLineHints`](SCHEMA.md#sourcelinehints) | table | 20 | Performance hints per source line (manifest `row_count` 0) |
| [`KernelInfo`](SCHEMA.md#kernelinfo) | table | 17 | Packed for catalog; **not** summary chrome |
| [`HintMessages`](SCHEMA.md#hintmessages) | table | 15 | Performance-hint message text (manifest `row_count` 0) |
| [`InstrTypes`](SCHEMA.md#instrtypes) | table | 15 | Instruction type names |
| [`ActiveInstrTypes`](SCHEMA.md#activeinstrtypes) | view | 12 | |
| [`InstrTypeHistClocks`](SCHEMA.md#instrtypehistclocks) | view | 12 | |
| [`InstrTypeHistCount`](SCHEMA.md#instrtypehistcount) | view | 12 | |
| [`ICacheRefillEvents`](SCHEMA.md#icacherefillevents) | table | 11 | |
| [`HintTypes`](SCHEMA.md#hinttypes) | table | 10 | Performance-hint type dictionary |
| [`InstrQueueTypes`](SCHEMA.md#instrqueuetypes) | table | 9 | Queue display names |
| [`KernelHints`](SCHEMA.md#kernelhints) | table | 8 | Kernel-level performance hints (manifest `row_count` 0) |
| [`SIMDStallsByAddr`](SCHEMA.md#simdstallsbyaddr) | table | 8 | |
| [`AiCoreOccupancy`](SCHEMA.md#aicoreoccupancy) | view | 3 | AICore occupancy intervals |
| [`CoreTypes`](SCHEMA.md#coretypes) | table | 3 | Core type names |
| [`ICacheStartingPCs`](SCHEMA.md#icachestartingpcs) | table | 3 | |

Plus leaf JSON (not contract tables): `core_0_tracing_report_0.json`, `aicore_utilization.json`, `manifest.json`.

Row counts are CSV data rows. `HintMessages`, `InstructionHints`, `KernelHints`, and `SourceLineHints` are packed even though `manifest.json` records `row_count` 0 and `file: null`.

---

## 2. Phase 1 + product UI (MHTML §11.2.3) + tracing — pack status on gelu

**Viewer packer SSOT (which embeds light which UI):** [FORMAT.md §4.1](FORMAT.md#41-embeds-used-by-report-visualization-sept-30--m4).

| Table / view | Kind | DB rows | In gelu pack? | Used for |
|---|---|---:|---|---|
| [`KernelInfo`](SCHEMA.md#kernelinfo) | table | 17 | optional | Packed for catalog; **not** summary chrome ([DATA-47](../../context/decisions/DATA.md)) |
| [`ExecutedInstructions`](SCHEMA.md#executedinstructions) | table | 6031 | yes | Hub; tracing; arch; roofline |
| [`ArchDiagramMetrics`](SCHEMA.md#archdiagrammetrics) | table | 240 | yes | Architecture Diagram |
| [`MemoryRWAccesses`](SCHEMA.md#memoryrwaccesses) | table | 34832 | yes | Memory heatmap (out of Sept 30 scope) |
| [`AiCoreOccupancy`](SCHEMA.md#aicoreoccupancy) | view | 3 | **yes** | AICore utilization overlay (out of scope) |
| [`PipesUtilization`](SCHEMA.md#pipesutilization) | table | 24 | **yes** | PIPE occupancy / CSV tab |
| [`PipeUtilizationHist`](SCHEMA.md#pipeutilizationhist) | view | 24 | **yes** | Util hist |
| [`Functions`](SCHEMA.md#functions) | table | 0 | no (empty) | Roofline VF names (ELF) |
| [`VectorUtilizations`](SCHEMA.md#vectorutilizations) | table | 480 | yes | Roofline |
| [`SourceInstructions`](SCHEMA.md#sourceinstructions) | table | 0 | no (empty) | Roofline / source join |
| [`VfIPC`](SCHEMA.md#vfipc) | table | 32 | yes | SIMD/SIMT VF IPC |
| [`VfSimtIPC`](SCHEMA.md#vfsimtipc) | table | 0 | no (empty) | needs SIMT IPC path |
| Call* / [`CallGraph`](SCHEMA.md#callgraph) … | table | 0 | no (empty) | Call stacks (ELF) |
| [`DispatchTime`](SCHEMA.md#dispatchtime) | table | 4265 | yes | Chrome Trace |
| [`InstrTypes`](SCHEMA.md#instrtypes) | table | 15 | **yes** | Instruction type names |
| [`CoreTypes`](SCHEMA.md#coretypes) | table | 3 | **yes** | Core type names |
| [`PipeDependency`](SCHEMA.md#pipedependency) | table | 118 | yes | Chrome Trace flows |
| [`ICacheEvents`](SCHEMA.md#icacheevents) | table | 2547 | yes | Chrome Trace ICache |
| [`ICacheRefillEvents`](SCHEMA.md#icacherefillevents) | table | 11 | **yes** | |
| [`QueueFullEvents`](SCHEMA.md#queuefullevents) | table | 0 | no (empty) | |
| [`UnitUtilization`](SCHEMA.md#unitutilization) | table | 736 | yes | |
| [`IssueQueueUtilization`](SCHEMA.md#issuequeueutilization) / [`ExecQueueUtilization`](SCHEMA.md#execqueueutilization) | table | 72 | yes | |

---

## 3. Populated in DB but **not** packed into gelu leaf

**None** among objects with manifest `row_count > 0` — each of those is a CSV embed.

Four performance-hint tables are packed **despite** manifest `row_count` 0 / `file: null`: `HintMessages.csv` (15), `InstructionHints.csv` (25), `KernelHints.csv` (8), `SourceLineHints.csv` (20). `HintTypes.csv` (10) is a normal populated dictionary.

---

## 4. Empty-but-schema-important (often flag / ELF gated)

75 objects have manifest `row_count=0`. Four of those are the packed hint tables above. The other 71 are not packed, including `CriticalPath` and `ScalarIpcDynamic` (both populated on the 2026-09-17 export, empty on this one). Notable:

| Name | Notes |
|---|---|
| [`SourceFiles`](SCHEMA.md#sourcefiles) / [`SourceLines`](SCHEMA.md#sourcelines) / [`DebugInfo`](SCHEMA.md#debuginfo) / [`BasicBlocks`](SCHEMA.md#basicblocks) / [`Functions`](SCHEMA.md#functions) | ELF / `--object-file` |
| [`TraceBubbles`](SCHEMA.md#tracebubbles) / [`TraceBubbleSummary`](SCHEMA.md#tracebubblesummary) | `--bubble` |
| [`VfSimtIPC`](SCHEMA.md#vfsimtipc)* / [`VfSimtInvocations`](SCHEMA.md#vfsimtinvocations) | SIMT IPC path |
| Call* | Call stacks (ELF) |
| [`MemoryUtilizationStates`](SCHEMA.md#memoryutilizationstates) | `--memory-utilization` |
| [`DCacheHitMissEvents`](SCHEMA.md#dcachehitmissevents) | quantitative indices |
| [`QueueFullEvents`](SCHEMA.md#queuefullevents) / [`QueueFullStalls`](SCHEMA.md#queuefullstalls) | not triggered on gelu |

Full empty list: `manifest.json` in [`data/gelu.npu-rep`](../../../data/gelu.npu-rep) → `objects` where `row_count == 0` (also enumerated in [SCHEMA.md](SCHEMA.md)).

---

## 5. `AnalysisState` on gelu (analyzers that ran)

See [`AnalysisState`](SCHEMA.md#analysisstate). `ascend950_scalar_ipc_analyzer` did not pass (`0`); the other listed analyzers passed, including pipe utilization/dependency, arch_diagram, shared bank conflicts, vf_ipc, unit/subqueue utilization, simd sampling, vector_utilization, dma_mov*, mmad, fixp, and region_tracing.

---

## 6. Older transfer sample

Pre-gelu inventory used export `2026-09-09` (`total_rows=67067`). Prefer **gelu** row counts and pack membership above when documenting what lands in a producer `.npu-rep`.
