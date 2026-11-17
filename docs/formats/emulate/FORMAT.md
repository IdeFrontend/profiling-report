# Emulate profile — data sections

**Profile:** `emulate` (npu_emulate).

Flat list of leaf embeds / contract CSVs (one markdown file per pack section). File name is `{section}.md` — strip `.md` to get the exact basename (`HintMessages.csv` ← `HintMessages.csv.md`).

Detection: leaf embeds [`manifest.json`](manifest.json.md) ([PROC-8](../../context/decisions/PROC.md)). Container: [formats README](../README.md). Compute: [../compute/FORMAT.md](../compute/FORMAT.md).
Full column catalog generator notes: [SCHEMA.md](SCHEMA.md). Pack status / Phase 1: [TABLES.md](TABLES.md). Adapter: [../ADAPTERS.md](../ADAPTERS.md). Views: [../../views/](../../views/).

**Time base:** simulation ticks → pack [`PipeTrace.json`](PipeTrace.json.md) in **µs** ([DATA-46](../../context/decisions/interim/DATA.md#data-46)).

## Sections

| Section |
|---------|
| [`ActiveInstrTypes.csv`](ActiveInstrTypes.csv.md) |
| [`aicore_utilization.json`](aicore_utilization.json.md) |
| [`AiCoreOccupancy.csv`](AiCoreOccupancy.csv.md) |
| [`AnalysisState.csv`](AnalysisState.csv.md) |
| [`ArchDiagramMetrics.csv`](ArchDiagramMetrics.csv.md) |
| [`AsmMetrics.csv`](AsmMetrics.csv.md) |
| [`BasicBlockCountDiagram.csv`](BasicBlockCountDiagram.csv.md) |
| [`BasicBlocks.csv`](BasicBlocks.csv.md) |
| [`BasicBlocksRelations.csv`](BasicBlocksRelations.csv.md) |
| [`BrifEvents.csv`](BrifEvents.csv.md) |
| [`CallFunctions.csv`](CallFunctions.csv.md) |
| [`CallGraph.csv`](CallGraph.csv.md) |
| [`CallGraphMetrics.csv`](CallGraphMetrics.csv.md) |
| [`CallStackIDs.csv`](CallStackIDs.csv.md) |
| [`CallStacks.csv`](CallStacks.csv.md) |
| [`CCUAllTickEvents.csv`](CCUAllTickEvents.csv.md) |
| [`CollectedSamples.csv`](CollectedSamples.csv.md) |
| [`CoreTypes.csv`](CoreTypes.csv.md) |
| [`CriticalPath.csv`](CriticalPath.csv.md) |
| [`DCacheBiuRequests.csv`](DCacheBiuRequests.csv.md) |
| [`DCacheHitMissEvents.csv`](DCacheHitMissEvents.csv.md) |
| [`DebugInfo.csv`](DebugInfo.csv.md) |
| [`DispatchTime.csv`](DispatchTime.csv.md) |
| [`DmaMovLoad2dParams.csv`](DmaMovLoad2dParams.csv.md) |
| [`DmaMovLoad3dParams.csv`](DmaMovLoad3dParams.csv.md) |
| [`DmaMovMultiParams.csv`](DmaMovMultiParams.csv.md) |
| [`DmaMovNdDmaParams.csv`](DmaMovNdDmaParams.csv.md) |
| [`DmaMovProcessedBytes.csv`](DmaMovProcessedBytes.csv.md) |
| [`DmaMovSimpleParams.csv`](DmaMovSimpleParams.csv.md) |
| [`ExecQueueUtilization.csv`](ExecQueueUtilization.csv.md) |
| [`ExecutedInstructions.csv`](ExecutedInstructions.csv.md) |
| [`ExecutionMasks.csv`](ExecutionMasks.csv.md) |
| [`FixpParams.csv`](FixpParams.csv.md) |
| [`Functions.csv`](Functions.csv.md) |
| [`HintMessages.csv`](HintMessages.csv.md) |
| [`HintTypes.csv`](HintTypes.csv.md) |
| [`ICacheEvents.csv`](ICacheEvents.csv.md) |
| [`ICacheRefillEvents.csv`](ICacheRefillEvents.csv.md) |
| [`ICacheStartingPCs.csv`](ICacheStartingPCs.csv.md) |
| [`InstrFetchStalls.csv`](InstrFetchStalls.csv.md) |
| [`InstrNameHistClocks.csv`](InstrNameHistClocks.csv.md) |
| [`InstrNameHistCount.csv`](InstrNameHistCount.csv.md) |
| [`InstrQueueTypes.csv`](InstrQueueTypes.csv.md) |
| [`InstrTypeHistClocks.csv`](InstrTypeHistClocks.csv.md) |
| [`InstrTypeHistCount.csv`](InstrTypeHistCount.csv.md) |
| [`InstrTypes.csv`](InstrTypes.csv.md) |
| [`InstructionHints.csv`](InstructionHints.csv.md) |
| [`InstructionHintsView.csv`](InstructionHintsView.csv.md) |
| [`IPCAsmMetrics.csv`](IPCAsmMetrics.csv.md) |
| [`IssueQueueUtilization.csv`](IssueQueueUtilization.csv.md) |
| [`JumpsDescription.csv`](JumpsDescription.csv.md) |
| [`KernelHints.csv`](KernelHints.csv.md) |
| [`KernelHintsView.csv`](KernelHintsView.csv.md) |
| [`KernelInfo.csv`](KernelInfo.csv.md) |
| [`LiveRegisters.csv`](LiveRegisters.csv.md) |
| [`manifest.json`](manifest.json.md) |
| [`MemoryHeatmapCells.csv`](MemoryHeatmapCells.csv.md) |
| [`MemoryHeatmapLayout.csv`](MemoryHeatmapLayout.csv.md) |
| [`MemoryRWAccesses.csv`](MemoryRWAccesses.csv.md) |
| [`MemoryUtilizationStates.csv`](MemoryUtilizationStates.csv.md) |
| [`MmadParams.csv`](MmadParams.csv.md) |
| [`PipeDependency.csv`](PipeDependency.csv.md) |
| [`PipeSamples.csv`](PipeSamples.csv.md) |
| [`PipesUtilization.csv`](PipesUtilization.csv.md) |
| [`PipeTrace.json`](PipeTrace.json.md) |
| [`PipeUtilizationHist.csv`](PipeUtilizationHist.csv.md) |
| [`PMUScalarCounters.csv`](PMUScalarCounters.csv.md) |
| [`PredicateRegValues.csv`](PredicateRegValues.csv.md) |
| [`QueueFullEvents.csv`](QueueFullEvents.csv.md) |
| [`QueueFullStalls.csv`](QueueFullStalls.csv.md) |
| [`RegionNames.csv`](RegionNames.csv.md) |
| [`Regions.csv`](Regions.csv.md) |
| [`RegisterUsageStalls.csv`](RegisterUsageStalls.csv.md) |
| [`SamplingStats.csv`](SamplingStats.csv.md) |
| [`ScalarIpcDynamic.csv`](ScalarIpcDynamic.csv.md) |
| [`Sections.csv`](Sections.csv.md) |
| [`SharedPatterns.csv`](SharedPatterns.csv.md) |
| [`SIMDSamplingStats.csv`](SIMDSamplingStats.csv.md) |
| [`SIMDStallReasonTypes.csv`](SIMDStallReasonTypes.csv.md) |
| [`SIMDStallsByAddr.csv`](SIMDStallsByAddr.csv.md) |
| [`SIMDStallsByLine.csv`](SIMDStallsByLine.csv.md) |
| [`SIMTExecutionMasks.csv`](SIMTExecutionMasks.csv.md) |
| [`SIMTGmAccessMetrics.csv`](SIMTGmAccessMetrics.csv.md) |
| [`SIMTGMPatterns.csv`](SIMTGMPatterns.csv.md) |
| [`SIMTLdStProcessedBytes.csv`](SIMTLdStProcessedBytes.csv.md) |
| [`SIMTRegisterRead.csv`](SIMTRegisterRead.csv.md) |
| [`SIMTSharedPatterns.csv`](SIMTSharedPatterns.csv.md) |
| [`SIMTWarpOccupancy.csv`](SIMTWarpOccupancy.csv.md) |
| [`SIMTWarpUtilization.csv`](SIMTWarpUtilization.csv.md) |
| [`SourceFiles.csv`](SourceFiles.csv.md) |
| [`SourceInstructions.csv`](SourceInstructions.csv.md) |
| [`SourceLineHints.csv`](SourceLineHints.csv.md) |
| [`SourceLineHintsView.csv`](SourceLineHintsView.csv.md) |
| [`SourceLineMetrics.csv`](SourceLineMetrics.csv.md) |
| [`SourceLines.csv`](SourceLines.csv.md) |
| [`SprInfoPerInstr.csv`](SprInfoPerInstr.csv.md) |
| [`SprWriteEvents.csv`](SprWriteEvents.csv.md) |
| [`SubQueueTypes.csv`](SubQueueTypes.csv.md) |
| [`SyncStalls.csv`](SyncStalls.csv.md) |
| [`TraceBubbles.csv`](TraceBubbles.csv.md) |
| [`TraceBubbleSummary.csv`](TraceBubbleSummary.csv.md) |
| [`UBBankConflicts.csv`](UBBankConflicts.csv.md) |
| [`UbBankConflictsCross.csv`](UbBankConflictsCross.csv.md) |
| [`UbRwAccesses.csv`](UbRwAccesses.csv.md) |
| [`UbRwStatistics.csv`](UbRwStatistics.csv.md) |
| [`UnitsUsageMetrics.csv`](UnitsUsageMetrics.csv.md) |
| [`UnitUtilization.csv`](UnitUtilization.csv.md) |
| [`VectorConfigState.csv`](VectorConfigState.csv.md) |
| [`VectorUtilizations.csv`](VectorUtilizations.csv.md) |
| [`VfIPC.csv`](VfIPC.csv.md) |
| [`VfIPCDynamic.csv`](VfIPCDynamic.csv.md) |
| [`VfIPCDynamicView.csv`](VfIPCDynamicView.csv.md) |
| [`VfIPCInside.csv`](VfIPCInside.csv.md) |
| [`VFMemoryRWAccesses.csv`](VFMemoryRWAccesses.csv.md) |
| [`VfPMUDeltasViewPerVf.csv`](VfPMUDeltasViewPerVf.csv.md) |
| [`VfPMUMetrics.csv`](VfPMUMetrics.csv.md) |
| [`VfPMUSummary.csv`](VfPMUSummary.csv.md) |
| [`VfPMUSynthTypes.csv`](VfPMUSynthTypes.csv.md) |
| [`VfPMUSynthValuesPerSubcore.csv`](VfPMUSynthValuesPerSubcore.csv.md) |
| [`VfPMUSynthValuesPerVf.csv`](VfPMUSynthValuesPerVf.csv.md) |
| [`VfPMUSynthViewPerSubcore.csv`](VfPMUSynthViewPerSubcore.csv.md) |
| [`VfPMUSynthViewPerVf.csv`](VfPMUSynthViewPerVf.csv.md) |
| [`VfPMUValues.csv`](VfPMUValues.csv.md) |
| [`VfPMUViewPerSubcore.csv`](VfPMUViewPerSubcore.csv.md) |
| [`VfSimtInvocations.csv`](VfSimtInvocations.csv.md) |
| [`VfSimtIPC.csv`](VfSimtIPC.csv.md) |
| [`VfSimtIPCDynamic.csv`](VfSimtIPCDynamic.csv.md) |
| [`VfSimtIPCDynamicView.csv`](VfSimtIPCDynamicView.csv.md) |
| [`VfSimtIPCInside.csv`](VfSimtIPCInside.csv.md) |

## Viewer packer (Sept 30)

<a id="viewer-packer-sept-30"></a>
<a id="41-embeds-used-by-report-visualization-sept-30--m4"></a>

### Embeds used by report visualization (Sept 30 / M4)

Packer checklist for the **currently lit** Asc Toolkit surfaces. Missing embeds → **hide** that surface ([DATA-30](../../context/decisions/DATA.md)); the leaf still opens. Do **not** invent compute-shaped names ([DATA-45](../../context/decisions/interim/DATA.md#data-45)).

| Embed (basename in `.npu-rep`) | View / surface | Adapter fill | Notes |
|--------------------------------|----------------|--------------|-------|
| [`manifest.json`](manifest.json.md) | Emulate detection | `isEmulateLeaf` / `adaptEmulate` | Required marker ([PROC-8](../../context/decisions/PROC.md)). Thin `{ profile, schemaVersion }` **or** export catalog |
| [`PipeTrace.json`](PipeTrace.json.md) | [Timeline](../../views/timeline.md) | `SwimlaneModel` (`sourceTimeUnit: us`) | **µs** `ts`/`dur` ([DATA-46](../../context/decisions/interim/DATA.md#data-46)). When `PipeTrace.json` is absent, **all** native `core_*_tracing_report_*.json` (non–critical-path) are **merged** into one swimlane with remapped pids, ordered by numeric core index ([PR-ASIM-007](../../../specs/core/adapt-emulate.spec.md)). Absent both → null swimlane |
| [`KernelInfo.csv`](KernelInfo.csv.md) | _(not 报告统计 chrome)_ | optional `csvTexts` only | **Out** of summary cards / meta ([DATA-47](../../context/decisions/DATA.md)). May remain packed for catalog / export |
| [`PipeUtilizationHist.csv`](PipeUtilizationHist.csv.md) (preferred) and/or [`PipesUtilization.csv`](PipesUtilization.csv.md) | [PIPE occupancy](../../views/pipe-occupancy.md) + 计算 详情 | `pipeOccupancy` + `computeTables` | Keep emulate basenames. Absent / all-NA → hide PIPE |
| [`ArchDiagramMetrics.csv`](ArchDiagramMetrics.csv.md) | [memory-topology](../../views/memory-topology.md) (Architecture Diagram fill) | `memoryTopology` + capability `archDiagram` | Interim plated chrome ([DATA-48a](../../context/decisions/interim/DATA.md)). Absent / undrawable → omit `archDiagram` |
| [`MemoryHeatmapLayout.csv`](MemoryHeatmapLayout.csv.md) + [`MemoryHeatmapCells.csv`](MemoryHeatmapCells.csv.md) (+ [`CoreTypes.csv`](CoreTypes.csv.md)) | [memory-topology § Memory Utilization Heatmap](../../views/memory-topology.md) | `memoryHeatmap` + capability `memoryHeatmap` | One view per Layout row; capacity per [DATA-51](../../context/decisions/DATA.md). No UbRw heat path ([DATA-50](../../context/decisions/DATA.md)). |
| [`HintMessages.csv`](HintMessages.csv.md) + [`HintTypes.csv`](HintTypes.csv.md) + [`InstructionHints.csv`](InstructionHints.csv.md) + [`KernelHints.csv`](KernelHints.csv.md) + [`SourceLineHints.csv`](SourceLineHints.csv.md) | [Performance hints](../../views/performance-hints.md) | `performanceHints` + capability `performanceHints` | Joined rows (53 on gelu, [PR-ASIM-009](../../../specs/core/adapt-emulate.spec.md)); RFC-4180 quoted `HintMsgText` decoded; `SourceLineId` shown raw when `SourceLines` is not packed ([PR-ASIM-012](../../../specs/core/adapt-emulate.spec.md)). Absent / no joined rows → omit |

**Also lit when the above mount:** StatsAside CANNBot scopes (**compute / memory** only — summary scope omitted with meta, [DATA-47](../../context/decisions/DATA.md)) from the same adapted fields — no extra embeds.

**Reference leaf (committed):** [`data/gelu.npu-rep`](../../../data/gelu.npu-rep) — playground + unit smoke. Roadmap: [milestone-4](../../process/roadmap/milestone-4.md). Per-surface detail: [`../../views/`](../../views/).

### Not used for Sept 30 visualization (packed or not)

| Embed / table | Product surface | Status |
|---------------|-----------------|--------|
| [`MemoryRWAccesses.csv`](MemoryRWAccesses.csv.md) | Memory Utilization Heatmap | **not used** — lattice SSOT is Layout+Cells ([DATA-50](../../context/decisions/DATA.md)); heat tabs are L1/UB/L0A/L0B/L0C only ([UI-60](../../context/decisions/UI.md)) |
| compute `Memory*.csv` / `memoryDiagram` | Asc 内存负载 | n/a on emulate |
| [`AiCoreOccupancy.csv`](AiCoreOccupancy.csv.md) / [`aicore_utilization.json`](aicore_utilization.json.md) | AICore occupancy overlay | out-of-scope |
| `VfIPC*.csv` / [`VfSimtIPC.csv`](VfSimtIPC.csv.md) | SIMD/SIMT VF IPC | out-of-scope |
| Call* / CallGraph* | Call stacks | out-of-scope |
| Roofline inputs (`Functions`, `ExecutedInstructions`, `VectorUtilizations`, …) | Roofline | **hide** (gap) |
| `Sampling.json` | Overview charts | **hide** (gap) |

Optional: other contract CSVs may be packed unused for later phases. **Not required:** sqlite3 blob (container type `5` reserved).
