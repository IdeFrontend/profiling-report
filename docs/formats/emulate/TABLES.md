# Emulate table inventory

**Profile:** `emulate` (npu_emulate contract SQLite / CSV export).

Scoped catalog for profiling-report consumers. Full contract DB is **101 tables + 23 views** (`total_objects=124`). This doc lists **pack status** and Phase 1 / product surfaces.

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
| [`MemoryRWAccesses`](MemoryRWAccesses.csv.md) | table | 34832 | Packed; **not** a heat source ([DATA-50](../../context/decisions/DATA.md)) |
| [`UbRwAccesses`](UbRwAccesses.csv.md) | table | 34832 | Packed; **not** a heat source (Layout+Cells SSOT) |
| [`SharedPatterns`](SharedPatterns.csv.md) | view | 34832 | Instr + shared address patterns |
| [`CCUAllTickEvents`](CCUAllTickEvents.csv.md) | table | 18131 | CCU tick stream |
| [`VfPMUValues`](VfPMUValues.csv.md) | table | 6880 | Per-VF PMU samples |
| [`VfPMUDeltasViewPerVf`](VfPMUDeltasViewPerVf.csv.md) | view | 6880 | Per-VF PMU deltas |
| [`ExecutedInstructions`](ExecutedInstructions.csv.md) | table | 6031 | Hub; 16 columns incl. wait/sync/VF class flags |
| [`DispatchTime`](DispatchTime.csv.md) | table | 4265 | Chrome Trace dispatch |
| [`ICacheEvents`](ICacheEvents.csv.md) | table | 2547 | ICache tracing |
| [`SprInfoPerInstr`](SprInfoPerInstr.csv.md) | table | 2014 | SPR values per instr |
| [`IPCAsmMetrics`](IPCAsmMetrics.csv.md) | view | 1248 | Per-instr IPC components |
| [`VfIPCDynamic`](VfIPCDynamic.csv.md) | table | 1216 | Windowed VF IPC |
| [`VfIPCInside`](VfIPCInside.csv.md) | table | 1216 | In-VF IPC |
| [`VfIPCDynamicView`](VfIPCDynamicView.csv.md) | view | 1216 | Windowed VF IPC by core |
| [`UnitsUsageMetrics`](UnitsUsageMetrics.csv.md) | table | 924 | Sub-core / warp usage |
| [`UnitUtilization`](UnitUtilization.csv.md) | table | 736 | Unit util time series |
| [`PredicateRegValues`](PredicateRegValues.csv.md) | table | 640 | Predicate registers |
| [`VectorUtilizations`](VectorUtilizations.csv.md) | table | 480 | Producer upstream for Roofline analyzer (viewer uses `Roofline*.csv`) |
| [`VfPMUViewPerSubcore`](VfPMUViewPerSubcore.csv.md) | view | 430 | PMU by subcore |
| [`SprWriteEvents`](SprWriteEvents.csv.md) | table | 350 | SPR writes |
| [`SIMDSamplingStats`](SIMDSamplingStats.csv.md) | table | 256 | SIMD stall samples |
| [`ArchDiagramMetrics`](ArchDiagramMetrics.csv.md) | table | 240 | Architecture diagram params |
| [`VfPMUMetrics`](VfPMUMetrics.csv.md) | table | 215 | PMU metric dictionary |
| [`PMUScalarCounters`](PMUScalarCounters.csv.md) | table | 141 | Scalar PMU counters |
| [`PipeDependency`](PipeDependency.csv.md) | table | 118 | Pipe dependency flows |
| [`ExecQueueUtilization`](ExecQueueUtilization.csv.md) | table | 72 | Exec queue util |
| [`IssueQueueUtilization`](IssueQueueUtilization.csv.md) | table | 72 | Issue queue util |
| [`BrifEvents`](BrifEvents.csv.md) | table | 64 | BRIF events |
| [`InstrNameHistClocks`](InstrNameHistClocks.csv.md) | view | 57 | |
| [`InstrNameHistCount`](InstrNameHistCount.csv.md) | view | 57 | |
| [`DmaMovProcessedBytes`](DmaMovProcessedBytes.csv.md) | table | 32 | DMA traffic |
| [`DmaMovSimpleParams`](DmaMovSimpleParams.csv.md) | table | 32 | Simple DMA params |
| [`VfIPC`](VfIPC.csv.md) | table | 32 | VF IPC aggregates |
| [`VfPMUSummary`](VfPMUSummary.csv.md) | table | 32 | |
| [`AnalysisState`](AnalysisState.csv.md) | table | 31 | Which analyzers ran |
| [`InstructionHints`](InstructionHints.csv.md) | table | 25 | Performance hints per PC (manifest `row_count` 0) |
| [`PipesUtilization`](PipesUtilization.csv.md) | table | 24 | PIPE occupancy |
| [`PipeUtilizationHist`](PipeUtilizationHist.csv.md) | view | 24 | PIPE hist (preferred for bars) |
| [`SourceLineHints`](SourceLineHints.csv.md) | table | 20 | Performance hints per source line (manifest `row_count` 0) |
| [`KernelInfo`](KernelInfo.csv.md) | table | 17 | Packed for catalog; **not** summary chrome |
| [`HintMessages`](HintMessages.csv.md) | table | 15 | Performance-hint message text (manifest `row_count` 0) |
| [`InstrTypes`](InstrTypes.csv.md) | table | 15 | Instruction type names |
| [`ActiveInstrTypes`](ActiveInstrTypes.csv.md) | view | 12 | |
| [`InstrTypeHistClocks`](InstrTypeHistClocks.csv.md) | view | 12 | |
| [`InstrTypeHistCount`](InstrTypeHistCount.csv.md) | view | 12 | |
| [`ICacheRefillEvents`](ICacheRefillEvents.csv.md) | table | 11 | |
| [`HintTypes`](HintTypes.csv.md) | table | 10 | Performance-hint type dictionary |
| [`InstrQueueTypes`](InstrQueueTypes.csv.md) | table | 9 | Queue display names |
| [`KernelHints`](KernelHints.csv.md) | table | 8 | Kernel-level performance hints (manifest `row_count` 0) |
| [`SIMDStallsByAddr`](SIMDStallsByAddr.csv.md) | table | 8 | |
| [`AiCoreOccupancy`](AiCoreOccupancy.csv.md) | view | 3 | AICore occupancy intervals |
| [`CoreTypes`](CoreTypes.csv.md) | table | 3 | Core type names |
| [`ICacheStartingPCs`](ICacheStartingPCs.csv.md) | table | 3 | |

Plus leaf JSON (not contract tables): `core_0_tracing_report_0.json`, `aicore_utilization.json`, `manifest.json`.

Row counts are CSV data rows. `HintMessages`, `InstructionHints`, `KernelHints`, and `SourceLineHints` are packed even though `manifest.json` records `row_count` 0 and `file: null`.

---

## 2. Phase 1 + product UI (MHTML §11.2.3) + tracing — pack status on gelu

**Viewer packer SSOT (which embeds light which UI):** [FORMAT.md Viewer packer](FORMAT.md#viewer-packer-sept-30).

| Table / view | Kind | DB rows | In gelu pack? | Used for |
|---|---|---:|---|---|
| [`KernelInfo`](KernelInfo.csv.md) | table | 17 | optional | Packed for catalog; **not** summary chrome ([DATA-47](../../context/decisions/DATA.md)) |
| [`ExecutedInstructions`](ExecutedInstructions.csv.md) | table | 6031 | yes | Hub; tracing; arch; roofline |
| [`ArchDiagramMetrics`](ArchDiagramMetrics.csv.md) | table | 240 | yes | Architecture Diagram |
| [`MemoryRWAccesses`](MemoryRWAccesses.csv.md) | table | 34832 | yes | Packed; not used for heat ([DATA-50](../../context/decisions/DATA.md)) |
| [`UbRwAccesses`](UbRwAccesses.csv.md) | table | 34832 | **yes** | Packed; not used for heat (Layout+Cells SSOT) |
| [`MemoryHeatmapLayout.csv`](MemoryHeatmapLayout.csv.md) / [`MemoryHeatmapCells.csv`](MemoryHeatmapCells.csv.md) | csv | — | **yes** (gelu) | Memory Utilization Heatmap lattice + capacity ([FORMAT Viewer packer](FORMAT.md#viewer-packer-sept-30); [DATA-50](../../context/decisions/DATA.md) / [DATA-51](../../context/decisions/DATA.md)) |
| [`AiCoreOccupancy`](AiCoreOccupancy.csv.md) | view | 3 | **yes** | AICore utilization overlay (out of scope) |
| [`PipesUtilization`](PipesUtilization.csv.md) | table | 24 | **yes** | PIPE occupancy / CSV tab |
| [`PipeUtilizationHist`](PipeUtilizationHist.csv.md) | view | 24 | **yes** | Util hist |
| [`Functions`](Functions.csv.md) | table | 0 | no (empty) | ELF VF names (analyzer input) |
| [`VectorUtilizations`](VectorUtilizations.csv.md) | table | 480 | yes | Analyzer input (viewer: `Roofline*.csv`) |
| [`SourceInstructions`](SourceInstructions.csv.md) | table | 0 | no (empty) | Source / analyzer join |
| [`VfIPC`](VfIPC.csv.md) | table | 32 | yes | SIMD/SIMT VF IPC |
| [`VfSimtIPC`](VfSimtIPC.csv.md) | table | 0 | no (empty) | needs SIMT IPC path |
| Call* / [`CallGraph`](CallGraph.csv.md) … | table | 0 | no (empty) | Call stacks (ELF) |
| [`DispatchTime`](DispatchTime.csv.md) | table | 4265 | yes | Chrome Trace |
| [`InstrTypes`](InstrTypes.csv.md) | table | 15 | **yes** | Instruction type names |
| [`CoreTypes`](CoreTypes.csv.md) | table | 3 | **yes** | Core type names |
| [`PipeDependency`](PipeDependency.csv.md) | table | 118 | yes | Chrome Trace flows |
| [`ICacheEvents`](ICacheEvents.csv.md) | table | 2547 | yes | Chrome Trace ICache |
| [`ICacheRefillEvents`](ICacheRefillEvents.csv.md) | table | 11 | **yes** | |
| [`QueueFullEvents`](QueueFullEvents.csv.md) | table | 0 | no (empty) | |
| [`UnitUtilization`](UnitUtilization.csv.md) | table | 736 | yes | |
| [`IssueQueueUtilization`](IssueQueueUtilization.csv.md) / [`ExecQueueUtilization`](ExecQueueUtilization.csv.md) | table | 72 | yes | |

---

## 3. Populated in DB but **not** packed into gelu leaf

**None** among objects with manifest `row_count > 0` — each of those is a CSV embed.

Four performance-hint tables are packed **despite** manifest `row_count` 0 / `file: null`: `HintMessages.csv` (15), `InstructionHints.csv` (25), `KernelHints.csv` (8), `SourceLineHints.csv` (20). `HintTypes.csv` (10) is a normal populated dictionary.

---

## 4. Empty-but-schema-important (often flag / ELF gated)

75 objects have manifest `row_count=0`. Four of those are the packed hint tables above. The other 71 are not packed, including `CriticalPath` and `ScalarIpcDynamic` (both populated on the 2026-09-17 export, empty on this one). Notable:

| Name | Notes |
|---|---|
| [`SourceFiles`](SourceFiles.csv.md) / [`SourceLines`](SourceLines.csv.md) / [`DebugInfo`](DebugInfo.csv.md) / [`BasicBlocks`](BasicBlocks.csv.md) / [`Functions`](Functions.csv.md) | ELF / `--object-file` |
| [`TraceBubbles`](TraceBubbles.csv.md) / [`TraceBubbleSummary`](TraceBubbleSummary.csv.md) | `--bubble` |
| [`VfSimtIPC`](VfSimtIPC.csv.md)* / [`VfSimtInvocations`](VfSimtInvocations.csv.md) | SIMT IPC path |
| Call* | Call stacks (ELF) |
| [`RooflinePoints`](RooflinePoints.csv.md) / [`RooflineComputePeaks`](RooflineComputePeaks.csv.md) / [`RooflineBandwidthPeaks`](RooflineBandwidthPeaks.csv.md) / [`RooflineMetadata`](RooflineMetadata.csv.md) | `--roofline`; absent from gelu ([DATA-57a](../../context/decisions/interim/DATA.md#data-57a)) |
| [`MemoryUtilizationStates`](MemoryUtilizationStates.csv.md) | `--memory-utilization` |
| [`DCacheHitMissEvents`](DCacheHitMissEvents.csv.md) | quantitative indices |
| [`QueueFullEvents`](QueueFullEvents.csv.md) / [`QueueFullStalls`](QueueFullStalls.csv.md) | not triggered on gelu |

Full empty list: `manifest.json` in [`data/gelu.npu-rep`](../../../data/gelu.npu-rep) → `objects` where `row_count == 0` (also enumerated in [SCHEMA.md](SCHEMA.md)).

---

## 5. `AnalysisState` on gelu (analyzers that ran)

See [`AnalysisState`](AnalysisState.csv.md). `ascend950_scalar_ipc_analyzer` did not pass (`0`); the other listed analyzers passed, including pipe utilization/dependency, arch_diagram, shared bank conflicts, vf_ipc, unit/subqueue utilization, simd sampling, vector_utilization, dma_mov*, mmad, fixp, and region_tracing.

---

## 6. Older transfer sample

Pre-gelu inventory used export `2026-09-09` (`total_rows=67067`). Prefer **gelu** row counts and pack membership above when documenting what lands in a producer `.npu-rep`.
