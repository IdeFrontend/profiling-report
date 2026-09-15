# Emulate table inventory

**Profile:** `emulate` (npu_emulate contract SQLite / CSV export).

Scoped catalog for profiling-report consumers. Full export may contain ~100 tables + ~22 views; this doc lists tables needed for **Phase 1 leaf pack**, **MHTML §11.2.3** product surfaces, and Chrome Trace packing — plus a short appendix of other populated objects in the transfer sample.

Contract + leaf pack: [FORMAT.md](FORMAT.md).

Sample export metadata: `total_objects=122`, `total_rows=67067`, exported `2026-09-09T16:35:20.396799+00:00`.

## 1. Phase 1 + product UI (MHTML §11.2.3) + tracing core

| Table / view | Kind | Sample rows | Key columns | Used for |
|---|---|---:|---|---|
| `KernelInfo` | table | 33 | KernelInfoAttr, KernelInfoVal | Phase 1 thin summary / identity |
| `ExecutedInstructions` | table | 527 | ExecInstrId, SourceInstrAddr, ExecInstrTickStart, ExecInstrTickEnd, ExecInstrName, ExecInstrParams, InstrTypeId, ExecInstrCoreId, CoreTypeId, ExtendParams, SourceInstrEncoding | Hub for almost all reports; tracing; arch diagram core count; roofline |
| `ArchDiagramMetrics` | table | 120 | ArchDiagramId, ArchDiagramParameterName, ArchDiagramParameterValue | MHTML Architecture Diagram; bandwidth metrics |
| `MemoryRWAccesses` | table | 1341 | AccessedAddress, AccessMode, AccessTime, MemoryType, ExecInstrId, CoreId | MHTML Memory heatmap |
| `AiCoreOccupancy` | view | 12 | CoreId, CoreTypeId, TickStart, TickEnd | MHTML AICore utilization / occupancy overlay |
| `PipesUtilization` | table | 24 | CoreId, CoreTypeId, InstrQueueTypeId, PipeUtilization | MHTML Sub-core / pipeline utilization |
| `PipeUtilizationHist` | view | 24 | PipeName, CoreName, Utilization | Source Assembly / util hist view |
| `Functions` | table | 0 | SourceInstrAddr, FunctionSize, FunctionName | Roofline VF names (ELF); Source Assembly |
| `VectorUtilizations` | table | 17 | ExecInstrId, ProcessedBytes, ProcessedElements, VectorUtilization | Roofline; Chrome Trace annotations |
| `SourceInstructions` | table | 0 | SourceInstrSection, SourceInstrAddr, SourceInstrEncoding, SourceInstrText, DebugInfoId, SourceInstrQueueType | Roofline VF text; tracing source join |
| `VfIPC` | table | 0 | ExecInstrId, ScalarIPC, ExecIPC, LdStIPC | MHTML SIMD/SIMT VF IPC (needs --vec-ipc) |
| `VfSimtIPC` | table | 0 | ExecInstrId, ExecIPC, LdStIPC, BranchIPC | MHTML SIMD/SIMT VF IPC (needs --vec-ipc) |
| `CallGraph` | table | 0 | CallFunctionId, ChildFunctionId, CallSiteLine | MHTML Call stacks (ELF) |
| `CallGraphMetrics` | table | 0 | CallFunctionId, SelfExecutionCount, SelfTickCount, TotalExecutionCount, TotalTickCount | MHTML Call stacks |
| `CallStacks` | table | 0 | CallFunctionId, StackId, StackLevel, CallSiteLine | Chrome Trace / call stack annotations |
| `CallStackIDs` | table | 0 | SourceInstrAddr, CallStackId | Chrome Trace call stack ids |
| `CallFunctions` | table | 0 | CallFunctionId, SourceFileId, FunctionName | Call stack function names |
| `DispatchTime` | table | 527 | ExecInstrId, DispatchTimeTick | Chrome Tracing dispatch events |
| `InstrTypes` | table | 15 | InstrTypeId, InstrTypeName | Instruction type names |
| `CoreTypes` | table | 3 | CoreTypeId, CoreTypeName | Core type names |
| `PipeDependency` | table | 42 | ExecInstrId, EventId, EventName, FlowEnd, CategoryId | Chrome Tracing pipe dependency flows |
| `ICacheEvents` | table | 527 | ICacheEventId, CoreId, CoreTypeId, EventTimeTick, SourceInstrAddr, EventSize, HitStatus, ICacheEventType | Chrome Tracing ICache |
| `ICacheRefillEvents` | table | 96 | EventId, SourceInstrAddr, ICacheEventType, CacheLineSize, CoreId, CoreTypeId, EventBeginTick, EventEndTick | Chrome Tracing / Summary |
| `QueueFullEvents` | table | 61 | EventId, ExecInstrId, CoreId, CoreTypeId, EventBeginTick, EventEndTick | Chrome Tracing queue full |
| `UnitUtilization` | table | 64 | Tick, Util, CoreId, CoreTypeId | Chrome Tracing unit util |
| `IssueQueueUtilization` | table | 60 | Tick, Util, CoreId, CoreTypeId, InstrTypeId | Issue queue report / tracing |
| `ExecQueueUtilization` | table | 60 | Tick, Util, CoreId, CoreTypeId, InstrTypeId | Chrome Tracing subqueue util |

## 2. Appendix — other populated objects in transfer sample

Not required for Phase 1 UI. Listed so packers know what else may appear in a full CSV export.

| Name | Kind | Sample rows |
|---|---|---:|
| `VfPMUValues` | table | 26624 |
| `VfPMUDeltasViewPerVf` | view | 26624 |
| `UbRwAccesses` | table | 1892 |
| `SharedPatterns` | view | 1892 |
| `VfPMUViewPerSubcore` | view | 832 |
| `SIMDSamplingStats` | table | 766 |
| `BrifEvents` | table | 543 |
| `CCUAllTickEvents` | table | 527 |
| `UnitsUsageMetrics` | table | 526 |
| `PMUScalarCounters` | table | 500 |
| `SprWriteEvents` | table | 500 |
| `SIMTRegisterRead` | table | 400 |
| `SIMTGMPatterns` | view | 272 |
| `VfPMUSummary` | table | 256 |
| `UbRwStatistics` | table | 226 |
| `DmaMovProcessedBytes` | table | 160 |
| `PredicateRegValues` | table | 142 |
| `SIMTSharedPatterns` | view | 128 |
| `VfPMUMetrics` | table | 104 |
| `UbBankConflictsCross` | table | 72 |
| `DmaMovSimpleParams` | table | 58 |
| `InstrNameHistClocks` | view | 56 |
| `InstrNameHistCount` | view | 56 |
| `SIMDStallReasonTypes` | table | 36 |
| `DmaMovNdDmaParams` | table | 33 |
| `DmaMovLoad3dParams` | table | 31 |
| `MmadParams` | table | 30 |
| `AnalysisState` | table | 28 |
| `FixpParams` | table | 28 |
| `DmaMovLoad2dParams` | table | 22 |
| `ExecutionMasks` | table | 18 |
| `SIMTExecutionMasks` | table | 18 |
| `SIMTLdStProcessedBytes` | table | 18 |
| `DmaMovMultiParams` | table | 16 |
| `ICacheStartingPCs` | table | 12 |
| `SIMTGmAccessMetrics` | table | 12 |
| `ActiveInstrTypes` | view | 12 |
| `InstrTypeHistClocks` | view | 12 |
| `InstrTypeHistCount` | view | 12 |
| `HintTypes` | table | 11 |
| … | … | (1 more) |

## 3. Empty-but-schema-important (often flag/ELF gated)

| Name | Notes |
|---|---|
| `SourceFiles` | ELF / `--object-file`; sample rows=0 |
| `SourceLines` | ELF / `--object-file`; sample rows=0 |
| `DebugInfo` | ELF / `--object-file`; sample rows=0 |
| `BasicBlocks` | ELF / `--object-file`; sample rows=0 |
| `TraceBubbles` | `--bubble` analyzer; sample rows=0 |
| `TraceBubbleSummary` | `--bubble` analyzer; sample rows=0 |
| `ScalarIpcDynamic` | `--scalar-ipc` / `--vec-ipc`; sample rows=0 |
| `VfIPCDynamic` | `--scalar-ipc` / `--vec-ipc`; sample rows=0 |
| `CriticalPath` | `--critical-path`; sample rows=0 |
| `MemoryUtilizationStates` | `--memory-utilization`; sample rows=0 |
| `DCacheHitMissEvents` | `--quantitative-indices` / analysis; sample rows=0 |
