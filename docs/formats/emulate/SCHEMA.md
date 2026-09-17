# Emulate contract schema

**Profile:** `emulate` (npu_emulate contract SQLite / CSV export).

Normative **object names**, **column names**, and **SQL types** come from [`data/gelu/manifest.json`](../../../data/gelu/manifest.json) (exported `2026-09-15T08:04:27.476042+00:00`, `total_objects=122`, tables=100, views=22, rows=169435).

Descriptions marked *inferred* are guesses from column names and known product surfaces (MHTML §11.2.3 / Phase 1), **not** producer documentation. Empty export types are shown as `(unspecified)`.

Leaf pack / Phase 1 inventory: [TABLES.md](TABLES.md). Container + leaf rules: [FORMAT.md](FORMAT.md).

Regenerate:

```bash
python3 data/scripts/gen_emulate_schema_md.py
```

## Contents

- [Tables (100)](#tables)
- [Views (22)](#views)
- [Naming / type notes](#naming--type-notes)

## Tables (100) {#tables}

- [`AnalysisState`](#analysisstate)
- [`ArchDiagramMetrics`](#archdiagrammetrics)
- [`BasicBlocks`](#basicblocks)
- [`BasicBlocksRelations`](#basicblocksrelations)
- [`BrifEvents`](#brifevents)
- [`CCUAllTickEvents`](#ccualltickevents)
- [`CallFunctions`](#callfunctions)
- [`CallGraph`](#callgraph)
- [`CallGraphMetrics`](#callgraphmetrics)
- [`CallStackIDs`](#callstackids)
- [`CallStacks`](#callstacks)
- [`CollectedSamples`](#collectedsamples)
- [`CoreTypes`](#coretypes)
- [`CriticalPath`](#criticalpath)
- [`DCacheBiuRequests`](#dcachebiurequests)
- [`DCacheHitMissEvents`](#dcachehitmissevents)
- [`DebugInfo`](#debuginfo)
- [`DispatchTime`](#dispatchtime)
- [`DmaMovLoad2dParams`](#dmamovload2dparams)
- [`DmaMovLoad3dParams`](#dmamovload3dparams)
- [`DmaMovMultiParams`](#dmamovmultiparams)
- [`DmaMovNdDmaParams`](#dmamovnddmaparams)
- [`DmaMovProcessedBytes`](#dmamovprocessedbytes)
- [`DmaMovSimpleParams`](#dmamovsimpleparams)
- [`ExecQueueUtilization`](#execqueueutilization)
- [`ExecutedInstructions`](#executedinstructions)
- [`ExecutionMasks`](#executionmasks)
- [`FixpParams`](#fixpparams)
- [`Functions`](#functions)
- [`HintMessages`](#hintmessages)
- [`HintTypes`](#hinttypes)
- [`ICacheEvents`](#icacheevents)
- [`ICacheRefillEvents`](#icacherefillevents)
- [`ICacheStartingPCs`](#icachestartingpcs)
- [`InstrFetchStalls`](#instrfetchstalls)
- [`InstrQueueTypes`](#instrqueuetypes)
- [`InstrTypes`](#instrtypes)
- [`InstructionHints`](#instructionhints)
- [`IssueQueueUtilization`](#issuequeueutilization)
- [`JumpsDescription`](#jumpsdescription)
- [`KernelInfo`](#kernelinfo)
- [`LiveRegisters`](#liveregisters)
- [`MemoryRWAccesses`](#memoryrwaccesses)
- [`MemoryUtilizationStates`](#memoryutilizationstates)
- [`MmadParams`](#mmadparams)
- [`PMUScalarCounters`](#pmuscalarcounters)
- [`PipeDependency`](#pipedependency)
- [`PipeSamples`](#pipesamples)
- [`PipesUtilization`](#pipesutilization)
- [`PredicateRegValues`](#predicateregvalues)
- [`QueueFullEvents`](#queuefullevents)
- [`QueueFullStalls`](#queuefullstalls)
- [`RegionNames`](#regionnames)
- [`Regions`](#regions)
- [`RegisterUsageStalls`](#registerusagestalls)
- [`SIMDSamplingStats`](#simdsamplingstats)
- [`SIMDStallReasonTypes`](#simdstallreasontypes)
- [`SIMDStallsByAddr`](#simdstallsbyaddr)
- [`SIMDStallsByLine`](#simdstallsbyline)
- [`SIMTExecutionMasks`](#simtexecutionmasks)
- [`SIMTGmAccessMetrics`](#simtgmaccessmetrics)
- [`SIMTLdStProcessedBytes`](#simtldstprocessedbytes)
- [`SIMTRegisterRead`](#simtregisterread)
- [`SIMTWarpOccupancy`](#simtwarpoccupancy)
- [`SIMTWarpUtilization`](#simtwarputilization)
- [`SamplingStats`](#samplingstats)
- [`ScalarIpcDynamic`](#scalaripcdynamic)
- [`Sections`](#sections)
- [`SourceFiles`](#sourcefiles)
- [`SourceInstructions`](#sourceinstructions)
- [`SourceLineHints`](#sourcelinehints)
- [`SourceLines`](#sourcelines)
- [`SprInfoPerInstr`](#sprinfoperinstr)
- [`SprWriteEvents`](#sprwriteevents)
- [`SubQueueTypes`](#subqueuetypes)
- [`SyncStalls`](#syncstalls)
- [`TraceBubbleSummary`](#tracebubblesummary)
- [`TraceBubbles`](#tracebubbles)
- [`UBBankConflicts`](#ubbankconflicts)
- [`UbBankConflictsCross`](#ubbankconflictscross)
- [`UbRwAccesses`](#ubrwaccesses)
- [`UbRwStatistics`](#ubrwstatistics)
- [`UnitUtilization`](#unitutilization)
- [`UnitsUsageMetrics`](#unitsusagemetrics)
- [`VFMemoryRWAccesses`](#vfmemoryrwaccesses)
- [`VectorConfigState`](#vectorconfigstate)
- [`VectorUtilizations`](#vectorutilizations)
- [`VfIPC`](#vfipc)
- [`VfIPCDynamic`](#vfipcdynamic)
- [`VfIPCInside`](#vfipcinside)
- [`VfPMUMetrics`](#vfpmumetrics)
- [`VfPMUSummary`](#vfpmusummary)
- [`VfPMUSynthTypes`](#vfpmusynthtypes)
- [`VfPMUSynthValuesPerSubcore`](#vfpmusynthvaluespersubcore)
- [`VfPMUSynthValuesPerVf`](#vfpmusynthvaluespervf)
- [`VfPMUValues`](#vfpmuvalues)
- [`VfSimtIPC`](#vfsimtipc)
- [`VfSimtIPCDynamic`](#vfsimtipcdynamic)
- [`VfSimtIPCInside`](#vfsimtipcinside)
- [`VfSimtInvocations`](#vfsimtinvocations)

### `AnalysisState` {#analysisstate}

| | |
|--|--|
| Kind | table |
| Gelu rows | 33 |
| CSV file | `AnalysisState.csv` |
| Role | Which analyzers ran and whether each passed. |

| Column | Type | Description |
|--------|------|-------------|
| `AnalysisName` | `VARCHAR(70)` | Human-readable name / label. *inferred* |
| `AnalysisPassed` | `BOOLEAN` | Boolean flag. *inferred* |

### `ArchDiagramMetrics` {#archdiagrammetrics}

| | |
|--|--|
| Kind | table |
| Gelu rows | 120 |
| CSV file | `ArchDiagramMetrics.csv` |
| Role | Architecture-diagram / bandwidth-style scalar parameters (MHTML §11.2.3.1). |

| Column | Type | Description |
|--------|------|-------------|
| `ArchDiagramId` | `INTEGER` | Identifier for `ArchDiagram`. *inferred* |
| `ArchDiagramParameterName` | `VARCHAR(20)` | Human-readable name / label. *inferred* |
| `ArchDiagramParameterValue` | `REAL` | Instruction or DMA / matmul parameter. *inferred* |

### `BasicBlocks` {#basicblocks}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `BasicBlocks.csv` |
| Role | ELF / source / call-graph metadata; often empty without `--object-file`. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `SourceInstrAddr` | `INTEGER` | Memory or instruction address. *inferred* |
| `BBLength` | `INTEGER` | Basic-block related field. *inferred* |
| `BBName` | `VARCHAR(64)` | Human-readable name / label. *inferred* |

### `BasicBlocksRelations` {#basicblocksrelations}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `BasicBlocksRelations.csv` |
| Role | ELF / source / call-graph metadata; often empty without `--object-file`. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `StartBlockId` | `INTEGER` | Identifier for `StartBlock`. *inferred* |
| `EndBlockId` | `INTEGER` | Identifier for `EndBlock`. *inferred* |

### `BrifEvents` {#brifevents}

| | |
|--|--|
| Kind | table |
| Gelu rows | 64 |
| CSV file | `BrifEvents.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `EventType` | `INTEGER` | Event id, name, or timing field. *inferred* |
| `EventTick` | `INTEGER` | Simulation time in ticks. *inferred* |
| `MteInstrId` | `INTEGER` | Identifier for `MteInstr`. *inferred* |
| `PackageAddr` | `VARCHAR(20)` | Memory or instruction address. *inferred* |
| `TagId` | `INTEGER` | Identifier for `Tag`. *inferred* |
| `GroupId` | `INTEGER` | Identifier for `Group`. *inferred* |

### `CCUAllTickEvents` {#ccualltickevents}

| | |
|--|--|
| Kind | table |
| Gelu rows | 18131 |
| CSV file | `CCUAllTickEvents.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `Tick` | `INTEGER` | Simulation time in ticks. *inferred* |
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `IsGeneralHazardPass` | `BOOLEAN` | Boolean flag. *inferred* |
| `IsPushInstrFail` | `BOOLEAN` | Boolean flag. *inferred* |

### `CallFunctions` {#callfunctions}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `CallFunctions.csv` |
| Role | ELF / source / call-graph metadata; often empty without `--object-file`. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CallFunctionId` | `INTEGER` | Identifier for `CallFunction`. *inferred* |
| `SourceFileId` | `INTEGER` | Identifier for `SourceFile`. *inferred* |
| `FunctionName` | `VARCHAR(128)` | Human-readable name / label. *inferred* |

### `CallGraph` {#callgraph}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `CallGraph.csv` |
| Role | Call-graph edges (ELF / object-file gated). |

| Column | Type | Description |
|--------|------|-------------|
| `CallFunctionId` | `INTEGER` | Identifier for `CallFunction`. *inferred* |
| `ChildFunctionId` | `INTEGER` | Identifier for `ChildFunction`. *inferred* |
| `CallSiteLine` | `INTEGER` | Source line number or id. *inferred* |

### `CallGraphMetrics` {#callgraphmetrics}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `CallGraphMetrics.csv` |
| Role | ELF / source / call-graph metadata; often empty without `--object-file`. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CallFunctionId` | `INTEGER` | Identifier for `CallFunction`. *inferred* |
| `SelfExecutionCount` | `INTEGER` | Count / cardinality. *inferred* |
| `SelfTickCount` | `INTEGER` | Simulation time in ticks. *inferred* |
| `TotalExecutionCount` | `INTEGER` | Count / cardinality. *inferred* |
| `TotalTickCount` | `INTEGER` | Simulation time in ticks. *inferred* |

### `CallStackIDs` {#callstackids}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `CallStackIDs.csv` |
| Role | ELF / source / call-graph metadata; often empty without `--object-file`. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `SourceInstrAddr` | `INTEGER` | Memory or instruction address. *inferred* |
| `CallStackId` | `INTEGER` | Identifier for `CallStack`. *inferred* |

### `CallStacks` {#callstacks}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `CallStacks.csv` |
| Role | Call-stack frames (ELF gated). |

| Column | Type | Description |
|--------|------|-------------|
| `CallFunctionId` | `INTEGER` | Identifier for `CallFunction`. *inferred* |
| `StackId` | `INTEGER` | Identifier for `Stack`. *inferred* |
| `StackLevel` | `INTEGER` | Call-graph / stack / function field (often ELF-gated). *inferred* |
| `CallSiteLine` | `INTEGER` | Source line number or id. *inferred* |

### `CollectedSamples` {#collectedsamples}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `CollectedSamples.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `Tick` | `INTEGER` | Simulation time in ticks. *inferred* |
| `Active` | `INTEGER` | Sampling counter bucket. *inferred* |
| `Stall` | `INTEGER` | Stall cycles or stall-related counter. *inferred* |
| `EmptyTicks` | `INTEGER` | Simulation time in ticks. *inferred* |

### `CoreTypes` {#coretypes}

| | |
|--|--|
| Kind | table |
| Gelu rows | 3 |
| CSV file | `CoreTypes.csv` |
| Role | Dictionary of core type id → name. |

| Column | Type | Description |
|--------|------|-------------|
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `CoreTypeName` | `VARCHAR(20)` | Human-readable name / label. *inferred* |

### `CriticalPath` {#criticalpath}

| | |
|--|--|
| Kind | table |
| Gelu rows | 60 |
| CSV file | `CriticalPath.csv` |
| Role | Critical-path event ↔ instruction links. |

| Column | Type | Description |
|--------|------|-------------|
| `EventId` | `INTEGER` | Identifier for `Event`. *inferred* |
| `InstrId` | `INTEGER` | Identifier for `Instr`. *inferred* |

### `DCacheBiuRequests` {#dcachebiurequests}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `DCacheBiuRequests.csv` |
| Role | Cache event / refill telemetry. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `EventId` | `INTEGER` | Identifier for `Event`. *inferred* |
| `SourceInstrAddr` | `INTEGER` | Memory or instruction address. *inferred* |
| `RequestSize` | `INTEGER` | Size in bytes (or related unit). *inferred* |
| `CacheLineAddress` | `INTEGER` | Memory or instruction address. *inferred* |
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `EventBeginTick` | `INTEGER` | Simulation time in ticks. *inferred* |
| `EventEndTick` | `INTEGER` | Simulation time in ticks. *inferred* |

### `DCacheHitMissEvents` {#dcachehitmissevents}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `DCacheHitMissEvents.csv` |
| Role | Cache event / refill telemetry. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `EventId` | `INTEGER` | Identifier for `Event`. *inferred* |
| `SourceInstrAddr` | `INTEGER` | Memory or instruction address. *inferred* |
| `CacheLineAddress` | `INTEGER` | Memory or instruction address. *inferred* |
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `IsHit` | `BOOLEAN` | Boolean flag. *inferred* |
| `EventTick` | `INTEGER` | Simulation time in ticks. *inferred* |

### `DebugInfo` {#debuginfo}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `DebugInfo.csv` |
| Role | ELF / source / call-graph metadata; often empty without `--object-file`. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `DebugInfoId` | `INTEGER` | Identifier for `DebugInfo`. *inferred* |
| `SourceLineId` | `INTEGER` | Identifier for `SourceLine`. *inferred* |
| `SourceFileId` | `INTEGER` | Identifier for `SourceFile`. *inferred* |
| `DebugInfoLineNum` | `INTEGER` | Source line number or id. *inferred* |

### `DispatchTime` {#dispatchtime}

| | |
|--|--|
| Kind | table |
| Gelu rows | 4265 |
| CSV file | `DispatchTime.csv` |
| Role | Dispatch tick per executed instruction (Chrome Trace dispatch). |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `DispatchTimeTick` | `INTEGER` | Simulation time in ticks. *inferred* |

### `DmaMovLoad2dParams` {#dmamovload2dparams}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `DmaMovLoad2dParams.csv` |
| Role | DMA-move parameters or traffic. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `MStartPosition` | `INTEGER` | Interval bound. *inferred* |
| `KStartPosition` | `INTEGER` | Interval bound. *inferred* |
| `MStep` | `INTEGER` | Geometry / addressing parameter. *inferred* |
| `KStep` | `INTEGER` | Geometry / addressing parameter. *inferred* |

### `DmaMovLoad3dParams` {#dmamovload3dparams}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `DmaMovLoad3dParams.csv` |
| Role | DMA-move parameters or traffic. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `MStep` | `INTEGER` | Geometry / addressing parameter. *inferred* |
| `KStep` | `INTEGER` | Geometry / addressing parameter. *inferred* |
| `Dst` | `VARCHAR(100)` | Geometry / addressing parameter. *inferred* |

### `DmaMovMultiParams` {#dmamovmultiparams}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `DmaMovMultiParams.csv` |
| Role | DMA-move parameters or traffic. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `N` | `INTEGER` | Numeric shape parameter. *inferred* |
| `D` | `INTEGER` | Numeric shape parameter. *inferred* |

### `DmaMovNdDmaParams` {#dmamovnddmaparams}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `DmaMovNdDmaParams.csv` |
| Role | DMA-move parameters or traffic. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `Loop0Size` | `INTEGER` | Size in bytes (or related unit). *inferred* |
| `Loop1Size` | `INTEGER` | Size in bytes (or related unit). *inferred* |
| `Loop2Size` | `INTEGER` | Size in bytes (or related unit). *inferred* |
| `Loop3Size` | `INTEGER` | Size in bytes (or related unit). *inferred* |
| `Loop4Size` | `INTEGER` | Size in bytes (or related unit). *inferred* |
| `Loop0LpSize` | `INTEGER` | Size in bytes (or related unit). *inferred* |
| `Loop0RpSize` | `INTEGER` | Size in bytes (or related unit). *inferred* |

### `DmaMovProcessedBytes` {#dmamovprocessedbytes}

| | |
|--|--|
| Kind | table |
| Gelu rows | 32 |
| CSV file | `DmaMovProcessedBytes.csv` |
| Role | DMA-move parameters or traffic. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `ProcessedBytes` | `INTEGER` | Size in bytes (or related unit). *inferred* |
| `MemoryTraffic` | `REAL` | Memory-system related field. *inferred* |
| `CacheHit` | `BOOLEAN` | Cache hit/miss related field. *inferred* |

### `DmaMovSimpleParams` {#dmamovsimpleparams}

| | |
|--|--|
| Kind | table |
| Gelu rows | 32 |
| CSV file | `DmaMovSimpleParams.csv` |
| Role | DMA-move parameters or traffic. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `BurstLength` | `INTEGER` | DMA / memory-copy geometry parameter. *inferred* |
| `BurstNumber` | `INTEGER` | DMA / memory-copy geometry parameter. *inferred* |
| `SrcStride` | `INTEGER` | DMA / memory-copy geometry parameter. *inferred* |
| `DstStride` | `INTEGER` | DMA / memory-copy geometry parameter. *inferred* |
| `SubBlockId` | `INTEGER` | Identifier for `SubBlock`. *inferred* |

### `ExecQueueUtilization` {#execqueueutilization}

| | |
|--|--|
| Kind | table |
| Gelu rows | 72 |
| CSV file | `ExecQueueUtilization.csv` |
| Role | Performance / utilization telemetry. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `Tick` | `INTEGER` | Simulation time in ticks. *inferred* |
| `Util` | `REAL` | Utilization ratio or percent. *inferred* |
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `InstrTypeId` | `INTEGER` | FK → InstrTypes. *inferred* |

### `ExecutedInstructions` {#executedinstructions}

| | |
|--|--|
| Kind | table |
| Gelu rows | 6031 |
| CSV file | `ExecutedInstructions.csv` |
| Role | Hub table: one row per dynamically executed instruction; join key for most reports. |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | Unique id of one dynamic instruction instance. |
| `SourceInstrAddr` | `INTEGER` | Static source / PC address of the instruction. |
| `ExecInstrTickStart` | `INTEGER` | Simulation tick when execution starts. |
| `ExecInstrTickEnd` | `INTEGER` | Simulation tick when execution ends. |
| `ExecInstrName` | `VARCHAR(100)` | Mnemonic / opcode name. |
| `ExecInstrParams` | `VARCHAR(100)` | Encoded or textual instruction parameters. |
| `InstrTypeId` | `INTEGER` | FK → InstrTypes. |
| `ExecInstrCoreId` | `INTEGER` | Core id that executed the instruction. |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. |
| `ExtendParams` | `TEXT` | Extended parameter blob / JSON-like text. |
| `SourceInstrEncoding` | `VARCHAR(24)` | Raw instruction encoding hex/text. |
| `ExecInstrIsWait` | `BOOLEAN` | True if this is a wait / stall-style instruction. |
| `ExecInstrIsSynchronization` | `BOOLEAN` | True if this is a synchronization instruction. |
| `ExecInstrIsDurationExcluded` | `BOOLEAN` | True if duration is excluded from timing aggregates. |
| `ExecInstrVfClass` | `INTEGER` | Vector-function class id (0 if none). |
| `ExecInstrVfSimtClass` | `INTEGER` | SIMT VF class id (0 if none). |

### `ExecutionMasks` {#executionmasks}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `ExecutionMasks.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecutionMaskId` | `INTEGER` | Identifier for `ExecutionMask`. *inferred* |
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `Mask` | `INTEGER` | Bitmask / predicate / lane mask. *inferred* |

### `FixpParams` {#fixpparams}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `FixpParams.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `N` | `INTEGER` | Numeric shape parameter. *inferred* |
| `M` | `INTEGER` | Numeric shape parameter. *inferred* |
| `L2CacheCtrlMode` | `VARCHAR(50)` | Operating mode / enum string. *inferred* |
| `HwChecksUnitFlag` | `BOOLEAN` | Boolean flag. *inferred* |
| `HwSetsUnitFlag` | `BOOLEAN` | Boolean flag. *inferred* |
| `PreQuantMode` | `VARCHAR(100)` | Operating mode / enum string. *inferred* |
| `PreReluMode` | `VARCHAR(20)` | Operating mode / enum string. *inferred* |
| `PreClipReluMode` | `VARCHAR(30)` | Operating mode / enum string. *inferred* |
| `F32ChannelSplitEnable` | `BOOLEAN` | Purpose unclear; present in contract schema. *inferred* |
| `PostClipReluMode` | `VARCHAR(30)` | Operating mode / enum string. *inferred* |
| `PostReluMode` | `VARCHAR(20)` | Operating mode / enum string. *inferred* |
| `NZ2NDEnable` | `BOOLEAN` | Purpose unclear; present in contract schema. *inferred* |
| `NZ2DNEnable` | `BOOLEAN` | Purpose unclear; present in contract schema. *inferred* |
| `C0PaddingEnable` | `BOOLEAN` | Purpose unclear; present in contract schema. *inferred* |
| `DstMode` | `VARCHAR(50)` | Operating mode / enum string. *inferred* |
| `DstUBMask` | `INTEGER` | Bitmask / predicate / lane mask. *inferred* |
| `ProcessedBytes` | `INTEGER` | Size in bytes (or related unit). *inferred* |

### `Functions` {#functions}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `Functions.csv` |
| Role | Function symbols from ELF. |

| Column | Type | Description |
|--------|------|-------------|
| `SourceInstrAddr` | `INTEGER` | Memory or instruction address. *inferred* |
| `FunctionSize` | `INTEGER` | Size in bytes (or related unit). *inferred* |
| `FunctionName` | `VARCHAR(128)` | Human-readable name / label. *inferred* |

### `HintMessages` {#hintmessages}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `HintMessages.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `HintMsgId` | `INTEGER` | Identifier for `HintMsg`. *inferred* |
| `HintMsgText` | `VARCHAR(500)` | Compiler / analyzer hint field. *inferred* |

### `HintTypes` {#hinttypes}

| | |
|--|--|
| Kind | table |
| Gelu rows | 11 |
| CSV file | `HintTypes.csv` |
| Role | Dictionary / enum lookup table. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `HintTypeId` | `INTEGER` | Identifier for `HintType`. *inferred* |
| `HintTypeName` | `VARCHAR(70)` | Human-readable name / label. *inferred* |
| `HintPassed` | `BOOLEAN` | Boolean flag. *inferred* |

### `ICacheEvents` {#icacheevents}

| | |
|--|--|
| Kind | table |
| Gelu rows | 2547 |
| CSV file | `ICacheEvents.csv` |
| Role | Instruction-cache access events for tracing. |

| Column | Type | Description |
|--------|------|-------------|
| `ICacheEventId` | `INTEGER` | Identifier for `ICacheEvent`. *inferred* |
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `EventTimeTick` | `INTEGER` | Simulation time in ticks. *inferred* |
| `SourceInstrAddr` | `INTEGER` | Memory or instruction address. *inferred* |
| `EventSize` | `INTEGER` | Size in bytes (or related unit). *inferred* |
| `HitStatus` | `BOOLEAN` | Cache hit/miss related field. *inferred* |
| `ICacheEventType` | `INTEGER` | Event id, name, or timing field. *inferred* |

### `ICacheRefillEvents` {#icacherefillevents}

| | |
|--|--|
| Kind | table |
| Gelu rows | 11 |
| CSV file | `ICacheRefillEvents.csv` |
| Role | Cache event / refill telemetry. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `EventId` | `INTEGER` | Identifier for `Event`. *inferred* |
| `SourceInstrAddr` | `INTEGER` | Memory or instruction address. *inferred* |
| `ICacheEventType` | `INTEGER` | Event id, name, or timing field. *inferred* |
| `CacheLineSize` | `INTEGER` | Size in bytes (or related unit). *inferred* |
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `EventBeginTick` | `INTEGER` | Simulation time in ticks. *inferred* |
| `EventEndTick` | `INTEGER` | Simulation time in ticks. *inferred* |

### `ICacheStartingPCs` {#icachestartingpcs}

| | |
|--|--|
| Kind | table |
| Gelu rows | 3 |
| CSV file | `ICacheStartingPCs.csv` |
| Role | Cache event / refill telemetry. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `StartingPC` | `INTEGER` | Program counter. *inferred* |

### `InstrFetchStalls` {#instrfetchstalls}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `InstrFetchStalls.csv` |
| Role | Stall, queue-full, or bubble analysis. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `InstrFetchStall` | `INTEGER` | Stall cycles or stall-related counter. *inferred* |

### `InstrQueueTypes` {#instrqueuetypes}

| | |
|--|--|
| Kind | table |
| Gelu rows | 9 |
| CSV file | `InstrQueueTypes.csv` |
| Role | Dictionary of instruction-queue / pipe type id → name. |

| Column | Type | Description |
|--------|------|-------------|
| `InstrQueueTypeId` | `INTEGER` | Identifier for `InstrQueueType`. *inferred* |
| `InstrQueueTypeName` | `VARCHAR(20)` | Human-readable name / label. *inferred* |

### `InstrTypes` {#instrtypes}

| | |
|--|--|
| Kind | table |
| Gelu rows | 15 |
| CSV file | `InstrTypes.csv` |
| Role | Dictionary of instruction type id → name. |

| Column | Type | Description |
|--------|------|-------------|
| `InstrTypeId` | `INTEGER` | FK → InstrTypes. *inferred* |
| `InstrTypeName` | `VARCHAR(20)` | Human-readable name / label. *inferred* |

### `InstructionHints` {#instructionhints}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `InstructionHints.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `HintId` | `INTEGER` | Identifier for `Hint`. *inferred* |
| `HintTypeId` | `INTEGER` | Identifier for `HintType`. *inferred* |
| `HintMsgId` | `INTEGER` | Identifier for `HintMsg`. *inferred* |
| `PC` | `INTEGER` | Program counter. *inferred* |

### `IssueQueueUtilization` {#issuequeueutilization}

| | |
|--|--|
| Kind | table |
| Gelu rows | 72 |
| CSV file | `IssueQueueUtilization.csv` |
| Role | Performance / utilization telemetry. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `Tick` | `INTEGER` | Simulation time in ticks. *inferred* |
| `Util` | `REAL` | Utilization ratio or percent. *inferred* |
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `InstrTypeId` | `INTEGER` | FK → InstrTypes. *inferred* |

### `JumpsDescription` {#jumpsdescription}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `JumpsDescription.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `Src` | `INTEGER` | Geometry / addressing parameter. *inferred* |
| `Dst` | `INTEGER` | Geometry / addressing parameter. *inferred* |

### `KernelInfo` {#kernelinfo}

| | |
|--|--|
| Kind | table |
| Gelu rows | 17 |
| CSV file | `KernelInfo.csv` |
| Role | Thin kernel identity / duration attribute–value pairs (Phase 1 summary). |

| Column | Type | Description |
|--------|------|-------------|
| `KernelInfoAttr` | `VARCHAR(20)` | Attribute key. *inferred* |
| `KernelInfoVal` | `(unspecified)` | Associated value. *inferred* |

### `LiveRegisters` {#liveregisters}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `LiveRegisters.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `LiveRegisterId` | `INTEGER` | Identifier for `LiveRegister`. *inferred* |
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `LiveGPRegisters` | `INTEGER` | Register / SPR / predicate field. *inferred* |
| `LiveSharedRegisters` | `INTEGER` | Register / SPR / predicate field. *inferred* |

### `MemoryRWAccesses` {#memoryrwaccesses}

| | |
|--|--|
| Kind | table |
| Gelu rows | 34832 |
| CSV file | `MemoryRWAccesses.csv` |
| Role | Per-access memory read/write events for heatmaps (MHTML §11.2.3.2). |

| Column | Type | Description |
|--------|------|-------------|
| `AccessedAddress` | `INTEGER` | Memory or instruction address. *inferred* |
| `AccessMode` | `VARCHAR(1)` | Operating mode / enum string. *inferred* |
| `AccessTime` | `INTEGER` | Time stamp or duration (ticks unless noted). *inferred* |
| `MemoryType` | `INTEGER` | Memory-system related field. *inferred* |
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |

### `MemoryUtilizationStates` {#memoryutilizationstates}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `MemoryUtilizationStates.csv` |
| Role | Performance / utilization telemetry. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `Tick` | `INTEGER` | Simulation time in ticks. *inferred* |
| `UtilizedBytes` | `INTEGER` | Size in bytes (or related unit). *inferred* |
| `MemoryType` | `INTEGER` | Memory-system related field. *inferred* |

### `MmadParams` {#mmadparams}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `MmadParams.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `M` | `INTEGER` | Numeric shape parameter. *inferred* |
| `K` | `INTEGER` | Numeric shape parameter. *inferred* |
| `N` | `INTEGER` | Numeric shape parameter. *inferred* |
| `MatrixADtype` | `VARCHAR(16)` | Data type of a matrix/tensor operand. *inferred* |
| `MatrixBDtype` | `VARCHAR(16)` | Data type of a matrix/tensor operand. *inferred* |
| `MatrixCDtype` | `VARCHAR(16)` | Data type of a matrix/tensor operand. *inferred* |
| `EnabledMode` | `VARCHAR(16)` | Operating mode / enum string. *inferred* |
| `MatrixAL0AAddress` | `INTEGER` | Memory or instruction address. *inferred* |
| `MatrixBL0BAddress` | `INTEGER` | Memory or instruction address. *inferred* |
| `MatrixCAddress` | `INTEGER` | Memory or instruction address. *inferred* |
| `HwChecksUnitFlag` | `BOOLEAN` | Boolean flag. *inferred* |
| `HwSetsUnitFlag` | `BOOLEAN` | Boolean flag. *inferred* |
| `GEMVModeEnable` | `BOOLEAN` | Operating mode / enum string. *inferred* |
| `MatrixCInBiasTableBuffer` | `BOOLEAN` | Matrix operand attribute. *inferred* |
| `MatrixCInitVal` | `BOOLEAN` | Associated value. *inferred* |
| `MatrixAProcessedBytes` | `INTEGER` | Size in bytes (or related unit). *inferred* |
| `MatrixBProcessedBytes` | `INTEGER` | Size in bytes (or related unit). *inferred* |
| `MatrixCProcessedBytes` | `INTEGER` | Size in bytes (or related unit). *inferred* |

### `PMUScalarCounters` {#pmuscalarcounters}

| | |
|--|--|
| Kind | table |
| Gelu rows | 141 |
| CSV file | `PMUScalarCounters.csv` |
| Role | Performance / utilization telemetry. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `CounterName` | `VARCHAR(64)` | Human-readable name / label. *inferred* |
| `CounterValue` | `INTEGER` | Count / cardinality. *inferred* |

### `PipeDependency` {#pipedependency}

| | |
|--|--|
| Kind | table |
| Gelu rows | 30 |
| CSV file | `PipeDependency.csv` |
| Role | Pipe dependency / sync flow edges for tracing. |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `EventId` | `INTEGER` | Identifier for `Event`. *inferred* |
| `EventName` | `VARCHAR(50)` | Human-readable name / label. *inferred* |
| `FlowEnd` | `INTEGER` | Interval bound. *inferred* |
| `CategoryId` | `INTEGER` | Identifier for `Category`. *inferred* |

### `PipeSamples` {#pipesamples}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `PipeSamples.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `PipeActive` | `INTEGER` | Queue or pipe related field. *inferred* |

### `PipesUtilization` {#pipesutilization}

| | |
|--|--|
| Kind | table |
| Gelu rows | 24 |
| CSV file | `PipesUtilization.csv` |
| Role | Per-core / per-queue pipe utilization ratios (MHTML §11.2.3.4 / PIPE UI). |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `InstrQueueTypeId` | `INTEGER` | Identifier for `InstrQueueType`. *inferred* |
| `PipeUtilization` | `REAL` | Utilization ratio or percent. *inferred* |

### `PredicateRegValues` {#predicateregvalues}

| | |
|--|--|
| Kind | table |
| Gelu rows | 640 |
| CSV file | `PredicateRegValues.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `PredRegIndex` | `INTEGER` | Register / SPR / predicate field. *inferred* |
| `PredRegLenBits` | `INTEGER` | Register / SPR / predicate field. *inferred* |
| `PredRegValue` | `VARCHAR(80)` | Register / SPR / predicate field. *inferred* |

### `QueueFullEvents` {#queuefullevents}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `QueueFullEvents.csv` |
| Role | Stall, queue-full, or bubble analysis. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `EventId` | `INTEGER` | Identifier for `Event`. *inferred* |
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `EventBeginTick` | `INTEGER` | Simulation time in ticks. *inferred* |
| `EventEndTick` | `INTEGER` | Simulation time in ticks. *inferred* |

### `QueueFullStalls` {#queuefullstalls}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `QueueFullStalls.csv` |
| Role | Stall, queue-full, or bubble analysis. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `QueueFullStall` | `INTEGER` | Stall cycles or stall-related counter. *inferred* |

### `RegionNames` {#regionnames}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `RegionNames.csv` |
| Role | Dictionary / enum lookup table. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `RegionNameId` | `INTEGER` | Identifier for `RegionName`. *inferred* |
| `RegionName` | `VARCHAR(20)` | Human-readable name / label. *inferred* |

### `Regions` {#regions}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `Regions.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `RegionNameId` | `INTEGER` | Identifier for `RegionName`. *inferred* |
| `RegionStart` | `INTEGER` | Register / SPR / predicate field. *inferred* |
| `RegionEnd` | `INTEGER` | Register / SPR / predicate field. *inferred* |
| `RegionCoreId` | `INTEGER` | Identifier for `RegionCore`. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `RegionTypeId` | `INTEGER` | Identifier for `RegionType`. *inferred* |
| `InstrQueueTypeId` | `INTEGER` | Identifier for `InstrQueueType`. *inferred* |
| `WarpId` | `INTEGER` | Identifier for `Warp`. *inferred* |

### `RegisterUsageStalls` {#registerusagestalls}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `RegisterUsageStalls.csv` |
| Role | Stall, queue-full, or bubble analysis. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `Memory` | `INTEGER` | Memory-system related field. *inferred* |
| `Execution` | `INTEGER` | Execution count or execution stall bucket. *inferred* |

### `SIMDSamplingStats` {#simdsamplingstats}

| | |
|--|--|
| Kind | table |
| Gelu rows | 256 |
| CSV file | `SIMDSamplingStats.csv` |
| Role | SIMD/SIMT sampling or execution metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `StallReasonId` | `INTEGER` | Identifier for `StallReason`. *inferred* |
| `StallCount` | `INTEGER` | Count / cardinality. *inferred* |

### `SIMDStallReasonTypes` {#simdstallreasontypes}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `SIMDStallReasonTypes.csv` |
| Role | SIMD/SIMT sampling or execution metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `StallReasonId` | `INTEGER` | Identifier for `StallReason`. *inferred* |
| `StallReasonName` | `VARCHAR(20)` | Human-readable name / label. *inferred* |

### `SIMDStallsByAddr` {#simdstallsbyaddr}

| | |
|--|--|
| Kind | table |
| Gelu rows | 8 |
| CSV file | `SIMDStallsByAddr.csv` |
| Role | SIMD/SIMT sampling or execution metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `SourceInstrAddr` | `INTEGER` | Memory or instruction address. *inferred* |
| `StallsJson` | `TEXT` | Stall cycles or stall-related counter. *inferred* |

### `SIMDStallsByLine` {#simdstallsbyline}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `SIMDStallsByLine.csv` |
| Role | SIMD/SIMT sampling or execution metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `SourceFileId` | `INTEGER` | Identifier for `SourceFile`. *inferred* |
| `DebugInfoLineNum` | `INTEGER` | Source line number or id. *inferred* |
| `StallsJson` | `TEXT` | Stall cycles or stall-related counter. *inferred* |

### `SIMTExecutionMasks` {#simtexecutionmasks}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `SIMTExecutionMasks.csv` |
| Role | SIMD/SIMT sampling or execution metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `PredicateMask` | `INTEGER` | Bitmask / predicate / lane mask. *inferred* |
| `ExecutionMask` | `INTEGER` | Bitmask / predicate / lane mask. *inferred* |
| `FullMask` | `INTEGER` | Bitmask / predicate / lane mask. *inferred* |
| `BranchEfficiency` | `FLOAT` | Efficiency / occupancy ratio. *inferred* |

### `SIMTGmAccessMetrics` {#simtgmaccessmetrics}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `SIMTGmAccessMetrics.csv` |
| Role | SIMD/SIMT sampling or execution metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `CacheLineCount` | `INTEGER` | Count / cardinality. *inferred* |
| `CacheLineUtilization` | `REAL` | Utilization ratio or percent. *inferred* |
| `MemAccessStride` | `INTEGER` | DMA / memory-copy geometry parameter. *inferred* |

### `SIMTLdStProcessedBytes` {#simtldstprocessedbytes}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `SIMTLdStProcessedBytes.csv` |
| Role | SIMD/SIMT sampling or execution metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `ExecInstrName` | `VARCHAR(100)` | Human-readable name / label. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `ProcessedBytes` | `INTEGER` | Size in bytes (or related unit). *inferred* |

### `SIMTRegisterRead` {#simtregisterread}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `SIMTRegisterRead.csv` |
| Role | SIMD/SIMT sampling or execution metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `RegIndex` | `INTEGER` | Register / SPR / predicate field. *inferred* |
| `Bias` | `INTEGER` | Address bias / offset. *inferred* |
| `ProcessedAddress` | `INTEGER` | Memory or instruction address. *inferred* |

### `SIMTWarpOccupancy` {#simtwarpoccupancy}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `SIMTWarpOccupancy.csv` |
| Role | SIMD/SIMT sampling or execution metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `WarpOccupancy` | `REAL` | SIMT warp related field. *inferred* |

### `SIMTWarpUtilization` {#simtwarputilization}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `SIMTWarpUtilization.csv` |
| Role | SIMD/SIMT sampling or execution metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `SIMTBlockId` | `INTEGER` | Identifier for `SIMTBlock`. *inferred* |
| `WarpId` | `INTEGER` | Identifier for `Warp`. *inferred* |
| `TickStart` | `INTEGER` | Simulation time in ticks. *inferred* |
| `Duration` | `INTEGER` | Duration (ticks or µs per producer). *inferred* |
| `WarpUtilization` | `REAL` | Utilization ratio or percent. *inferred* |
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |

### `SamplingStats` {#samplingstats}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `SamplingStats.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `Active` | `INTEGER` | Sampling counter bucket. *inferred* |
| `Stall` | `INTEGER` | Stall cycles or stall-related counter. *inferred* |
| `EmptyTicks` | `INTEGER` | Simulation time in ticks. *inferred* |

### `ScalarIpcDynamic` {#scalaripcdynamic}

| | |
|--|--|
| Kind | table |
| Gelu rows | 4133 |
| CSV file | `ScalarIpcDynamic.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `Tick` | `INTEGER` | Simulation time in ticks. *inferred* |
| `IPC` | `REAL` | Instructions-per-cycle metric. *inferred* |

### `Sections` {#sections}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `Sections.csv` |
| Role | ELF / source / call-graph metadata; often empty without `--object-file`. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `SectionId` | `INTEGER` | Identifier for `Section`. *inferred* |
| `SectionName` | `VARCHAR(128)` | Human-readable name / label. *inferred* |

### `SourceFiles` {#sourcefiles}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `SourceFiles.csv` |
| Role | ELF / source / call-graph metadata; often empty without `--object-file`. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `SourceFileId` | `INTEGER` | Identifier for `SourceFile`. *inferred* |
| `SourceFilePath` | `VARCHAR(200)` | Source file path or id. *inferred* |

### `SourceInstructions` {#sourceinstructions}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `SourceInstructions.csv` |
| Role | Static source/disassembly instructions (ELF gated). |

| Column | Type | Description |
|--------|------|-------------|
| `SourceInstrSection` | `INTEGER` | ELF / binary section field. *inferred* |
| `SourceInstrAddr` | `INTEGER` | Memory or instruction address. *inferred* |
| `SourceInstrEncoding` | `VARCHAR(24)` | Instruction-related field. *inferred* |
| `SourceInstrText` | `VARCHAR(200)` | Instruction-related field. *inferred* |
| `DebugInfoId` | `INTEGER` | Identifier for `DebugInfo`. *inferred* |
| `SourceInstrQueueType` | `INTEGER` | Queue or pipe related field. *inferred* |

### `SourceLineHints` {#sourcelinehints}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `SourceLineHints.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `HintId` | `INTEGER` | Identifier for `Hint`. *inferred* |
| `HintTypeId` | `INTEGER` | Identifier for `HintType`. *inferred* |
| `HintMsgId` | `INTEGER` | Identifier for `HintMsg`. *inferred* |
| `SourceLineId` | `INTEGER` | Identifier for `SourceLine`. *inferred* |

### `SourceLines` {#sourcelines}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `SourceLines.csv` |
| Role | ELF / source / call-graph metadata; often empty without `--object-file`. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `SourceLineId` | `INTEGER` | Identifier for `SourceLine`. *inferred* |
| `SourceLine` | `VARCHAR(200)` | Source line number or id. *inferred* |

### `SprInfoPerInstr` {#sprinfoperinstr}

| | |
|--|--|
| Kind | table |
| Gelu rows | 2014 |
| CSV file | `SprInfoPerInstr.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `SprName` | `VARCHAR(20)` | Human-readable name / label. *inferred* |
| `SprValue` | `VARCHAR(20)` | Register / SPR / predicate field. *inferred* |

### `SprWriteEvents` {#sprwriteevents}

| | |
|--|--|
| Kind | table |
| Gelu rows | 350 |
| CSV file | `SprWriteEvents.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `EventTick` | `INTEGER` | Simulation time in ticks. *inferred* |
| `SprName` | `VARCHAR(20)` | Human-readable name / label. *inferred* |
| `SprValue` | `VARCHAR(20)` | Register / SPR / predicate field. *inferred* |

### `SubQueueTypes` {#subqueuetypes}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `SubQueueTypes.csv` |
| Role | Dictionary / enum lookup table. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `SubQueueType` | `INTEGER` | Queue or pipe related field. *inferred* |

### `SyncStalls` {#syncstalls}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `SyncStalls.csv` |
| Role | Stall, queue-full, or bubble analysis. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `SyncStall` | `INTEGER` | Stall cycles or stall-related counter. *inferred* |

### `TraceBubbleSummary` {#tracebubblesummary}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `TraceBubbleSummary.csv` |
| Role | Stall, queue-full, or bubble analysis. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `MainPipeline` | `TEXT` | Queue or pipe related field. *inferred* |
| `TotalDurationUs` | `REAL` | Duration (ticks or µs per producer). *inferred* |
| `BubbleCount` | `INTEGER` | Count / cardinality. *inferred* |
| `TopBottleneck` | `TEXT` | Trace bubble / idle-gap analysis field. *inferred* |
| `SubtypeSummary` | `TEXT` | Classification / category label. *inferred* |

### `TraceBubbles` {#tracebubbles}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `TraceBubbles.csv` |
| Role | Stall, queue-full, or bubble analysis. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `MainPipeline` | `TEXT` | Queue or pipe related field. *inferred* |
| `SubType` | `TEXT` | Classification / category label. *inferred* |
| `Category` | `TEXT` | Classification / category label. *inferred* |
| `TickStart` | `INTEGER` | Simulation time in ticks. *inferred* |
| `TickEnd` | `INTEGER` | Simulation time in ticks. *inferred* |
| `GapTicks` | `INTEGER` | Simulation time in ticks. *inferred* |
| `GapUs` | `REAL` | Trace bubble / idle-gap analysis field. *inferred* |
| `Reason` | `TEXT` | Stall or failure reason id/name. *inferred* |
| `Optimizable` | `INTEGER` | Purpose unclear; present in contract schema. *inferred* |
| `OptimizationHint` | `TEXT` | Compiler / analyzer hint field. *inferred* |
| `WaitedPipeline` | `TEXT` | Queue or pipe related field. *inferred* |
| `IterationIndex` | `INTEGER` | Purpose unclear; present in contract schema. *inferred* |

### `UBBankConflicts` {#ubbankconflicts}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `UBBankConflicts.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `UBBankConflictId` | `INTEGER` | Identifier for `UBBankConflict`. *inferred* |
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `ReadConflicts` | `INTEGER` | Bank / resource conflict counter. *inferred* |
| `WriteConflicts` | `INTEGER` | Bank / resource conflict counter. *inferred* |

### `UbBankConflictsCross` {#ubbankconflictscross}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `UbBankConflictsCross.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `ConflictInstrs` | `VARCHAR(64)` | Bank / resource conflict counter. *inferred* |
| `ConflictCount` | `INTEGER` | Count / cardinality. *inferred* |
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |

### `UbRwAccesses` {#ubrwaccesses}

| | |
|--|--|
| Kind | table |
| Gelu rows | 34832 |
| CSV file | `UbRwAccesses.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `AccessedAddress` | `INTEGER` | Memory or instruction address. *inferred* |

### `UbRwStatistics` {#ubrwstatistics}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `UbRwStatistics.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `ProcessedBytes` | `INTEGER` | Size in bytes (or related unit). *inferred* |
| `UbAccessType` | `INTEGER` | Memory-system related field. *inferred* |
| `SimtDataCache` | `BOOLEAN` | Cache-related field. *inferred* |

### `UnitUtilization` {#unitutilization}

| | |
|--|--|
| Kind | table |
| Gelu rows | 736 |
| CSV file | `UnitUtilization.csv` |
| Role | Performance / utilization telemetry. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `Tick` | `INTEGER` | Simulation time in ticks. *inferred* |
| `Util` | `REAL` | Utilization ratio or percent. *inferred* |
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |

### `UnitsUsageMetrics` {#unitsusagemetrics}

| | |
|--|--|
| Kind | table |
| Gelu rows | 924 |
| CSV file | `UnitsUsageMetrics.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `SourceInstrAddr` | `INTEGER` | Memory or instruction address. *inferred* |
| `UniqueSubCoresUsed` | `INTEGER` | Cardinality of unique resources used. *inferred* |
| `UniqueWarpsUsed` | `INTEGER` | SIMT warp related field. *inferred* |

### `VFMemoryRWAccesses` {#vfmemoryrwaccesses}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `VFMemoryRWAccesses.csv` |
| Role | Vector-function (VF) metrics or metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `AccessedAddress` | `INTEGER` | Memory or instruction address. *inferred* |
| `AccessMode` | `VARCHAR(1)` | Operating mode / enum string. *inferred* |
| `AccessTime` | `INTEGER` | Time stamp or duration (ticks unless noted). *inferred* |
| `MemoryType` | `INTEGER` | Memory-system related field. *inferred* |
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |

### `VectorConfigState` {#vectorconfigstate}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `VectorConfigState.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `VectorConfigStateId` | `INTEGER` | Identifier for `VectorConfigState`. *inferred* |
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `VectorConfigValue` | `INTEGER` | Associated value. *inferred* |

### `VectorUtilizations` {#vectorutilizations}

| | |
|--|--|
| Kind | table |
| Gelu rows | 480 |
| CSV file | `VectorUtilizations.csv` |
| Role | Vector unit bytes/elements/utilization for roofline-style views. |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `ProcessedBytes` | `INTEGER` | Size in bytes (or related unit). *inferred* |
| `ProcessedElements` | `INTEGER` | Work processed (bytes or elements). *inferred* |
| `VectorUtilization` | `REAL` | Utilization ratio or percent. *inferred* |

### `VfIPC` {#vfipc}

| | |
|--|--|
| Kind | table |
| Gelu rows | 32 |
| CSV file | `VfIPC.csv` |
| Role | Per-VF IPC aggregates (MHTML §11.2.3.7). |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `ScalarIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `ExecIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `LdStIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |

### `VfIPCDynamic` {#vfipcdynamic}

| | |
|--|--|
| Kind | table |
| Gelu rows | 1216 |
| CSV file | `VfIPCDynamic.csv` |
| Role | Time-windowed VF IPC samples. |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `WindowStartTick` | `INTEGER` | Simulation time in ticks. *inferred* |
| `ScalarIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `ExecIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `LdStIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |

### `VfIPCInside` {#vfipcinside}

| | |
|--|--|
| Kind | table |
| Gelu rows | 1216 |
| CSV file | `VfIPCInside.csv` |
| Role | In-VF IPC breakdown. |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `ScalarIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `ExecIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `LdStIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |

### `VfPMUMetrics` {#vfpmumetrics}

| | |
|--|--|
| Kind | table |
| Gelu rows | 215 |
| CSV file | `VfPMUMetrics.csv` |
| Role | Vector-function (VF) metrics or metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `MetricId` | `INTEGER` | Identifier for `Metric`. *inferred* |
| `MetricName` | `VARCHAR(50)` | Human-readable name / label. *inferred* |

### `VfPMUSummary` {#vfpmusummary}

| | |
|--|--|
| Kind | table |
| Gelu rows | 32 |
| CSV file | `VfPMUSummary.csv` |
| Role | Vector-function (VF) metrics or metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `VfId` | `INTEGER` | Identifier for `Vf`. *inferred* |
| `VfKernelTicks` | `INTEGER` | Simulation time in ticks. *inferred* |
| `VfSystemTicks` | `INTEGER` | Simulation time in ticks. *inferred* |

### `VfPMUSynthTypes` {#vfpmusynthtypes}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `VfPMUSynthTypes.csv` |
| Role | Vector-function (VF) metrics or metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `SynthId` | `INTEGER` | Identifier for `Synth`. *inferred* |
| `SynthName` | `VARCHAR(64)` | Human-readable name / label. *inferred* |
| `SynthParentId` | `INTEGER` | Identifier for `SynthParent`. *inferred* |
| `SynthLevel` | `INTEGER` | Synthetic PMU metric field. *inferred* |
| `SynthScope` | `INTEGER` | Synthetic PMU metric field. *inferred* |

### `VfPMUSynthValuesPerSubcore` {#vfpmusynthvaluespersubcore}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `VfPMUSynthValuesPerSubcore.csv` |
| Role | Vector-function (VF) metrics or metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `SynthId` | `INTEGER` | Identifier for `Synth`. *inferred* |
| `SynthValue` | `REAL` | Synthetic PMU metric field. *inferred* |

### `VfPMUSynthValuesPerVf` {#vfpmusynthvaluespervf}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `VfPMUSynthValuesPerVf.csv` |
| Role | Vector-function (VF) metrics or metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `VfId` | `INTEGER` | Identifier for `Vf`. *inferred* |
| `SynthId` | `INTEGER` | Identifier for `Synth`. *inferred* |
| `SynthValue` | `REAL` | Synthetic PMU metric field. *inferred* |

### `VfPMUValues` {#vfpmuvalues}

| | |
|--|--|
| Kind | table |
| Gelu rows | 6880 |
| CSV file | `VfPMUValues.csv` |
| Role | Vector-function (VF) metrics or metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `VfId` | `INTEGER` | Identifier for `Vf`. *inferred* |
| `MetricId` | `INTEGER` | Identifier for `Metric`. *inferred* |
| `MetricValue` | `INTEGER` | PMU / metric identifier or value. *inferred* |

### `VfSimtIPC` {#vfsimtipc}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `VfSimtIPC.csv` |
| Role | SIMT VF IPC aggregates. |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `ExecIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `LdStIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `BranchIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |

### `VfSimtIPCDynamic` {#vfsimtipcdynamic}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `VfSimtIPCDynamic.csv` |
| Role | Vector-function (VF) metrics or metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `WindowStartTick` | `INTEGER` | Simulation time in ticks. *inferred* |
| `ExecIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `LdStIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `BranchIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |

### `VfSimtIPCInside` {#vfsimtipcinside}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `VfSimtIPCInside.csv` |
| Role | Vector-function (VF) metrics or metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `ExecIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `LdStIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `BranchIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |

### `VfSimtInvocations` {#vfsimtinvocations}

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `VfSimtInvocations.csv` |
| Role | Vector-function (VF) metrics or metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `VfSimtAddr` | `INTEGER` | Memory or instruction address. *inferred* |
| `KernelAddr` | `INTEGER` | Memory or instruction address. *inferred* |
| `ThreadDimX` | `INTEGER` | Thread / launch dimension field. *inferred* |
| `ThreadDimY` | `INTEGER` | Thread / launch dimension field. *inferred* |
| `ThreadDimZ` | `INTEGER` | Thread / launch dimension field. *inferred* |
| `RegisterNum` | `INTEGER` | Register / SPR / predicate field. *inferred* |
| `CodeSizeBytes` | `INTEGER` | Size in bytes (or related unit). *inferred* |

## Views (22) {#views}

- [`ActiveInstrTypes`](#activeinstrtypes)
- [`AiCoreOccupancy`](#aicoreoccupancy)
- [`AsmMetrics`](#asmmetrics)
- [`BasicBlockCountDiagram`](#basicblockcountdiagram)
- [`IPCAsmMetrics`](#ipcasmmetrics)
- [`InstrNameHistClocks`](#instrnamehistclocks)
- [`InstrNameHistCount`](#instrnamehistcount)
- [`InstrTypeHistClocks`](#instrtypehistclocks)
- [`InstrTypeHistCount`](#instrtypehistcount)
- [`InstructionHintsView`](#instructionhintsview)
- [`PipeUtilizationHist`](#pipeutilizationhist)
- [`SIMTGMPatterns`](#simtgmpatterns)
- [`SIMTSharedPatterns`](#simtsharedpatterns)
- [`SharedPatterns`](#sharedpatterns)
- [`SourceLineHintsView`](#sourcelinehintsview)
- [`SourceLineMetrics`](#sourcelinemetrics)
- [`VfIPCDynamicView`](#vfipcdynamicview)
- [`VfPMUDeltasViewPerVf`](#vfpmudeltasviewpervf)
- [`VfPMUSynthViewPerSubcore`](#vfpmusynthviewpersubcore)
- [`VfPMUSynthViewPerVf`](#vfpmusynthviewpervf)
- [`VfPMUViewPerSubcore`](#vfpmuviewpersubcore)
- [`VfSimtIPCDynamicView`](#vfsimtipcdynamicview)

### `ActiveInstrTypes` {#activeinstrtypes}

| | |
|--|--|
| Kind | view |
| Gelu rows | 12 |
| CSV file | `ActiveInstrTypes.csv` |
| Role | Dictionary / enum lookup table. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `Name` | `VARCHAR(20)` | Human-readable name / label. *inferred* |

### `AiCoreOccupancy` {#aicoreoccupancy}

| | |
|--|--|
| Kind | view |
| Gelu rows | 3 |
| CSV file | `AiCoreOccupancy.csv` |
| Role | AICore busy intervals for occupancy overlay (MHTML §11.2.3.3). |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `TickStart` | `(unspecified)` | Simulation time in ticks. *inferred* |
| `TickEnd` | `(unspecified)` | Simulation time in ticks. *inferred* |

### `AsmMetrics` {#asmmetrics}

| | |
|--|--|
| Kind | view |
| Gelu rows | 0 |
| CSV file | `AsmMetrics.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `PC` | `INTEGER` | Program counter. *inferred* |
| `InstrName` | `VARCHAR(200)` | Human-readable name / label. *inferred* |
| `CallStackId` | `INTEGER` | Identifier for `CallStack`. *inferred* |
| `FileId` | `INTEGER` | Identifier for `File`. *inferred* |
| `LineId` | `INTEGER` | Identifier for `Line`. *inferred* |
| `LineNum` | `INTEGER` | Source line number or id. *inferred* |
| `Pipe` | `VARCHAR(20)` | Queue or pipe related field. *inferred* |
| `RelTime` | `(unspecified)` | Time stamp or duration (ticks unless noted). *inferred* |
| `ExecutionCount` | `(unspecified)` | Count / cardinality. *inferred* |
| `InstrParams` | `VARCHAR(100)` | Instruction or DMA / matmul parameter. *inferred* |
| `TickCount` | `(unspecified)` | Simulation time in ticks. *inferred* |
| `UBBankConflicts` | `(unspecified)` | Bank / resource conflict counter. *inferred* |
| `UBCrossInstructionBankConflicts` | `(unspecified)` | Bank / resource conflict counter. *inferred* |
| `VectorUtilization` | `(unspecified)` | Utilization ratio or percent. *inferred* |
| `LiveGPRegisters` | `(unspecified)` | Register / SPR / predicate field. *inferred* |
| `LiveSharedRegisters` | `(unspecified)` | Register / SPR / predicate field. *inferred* |
| `DmaSrcStride` | `(unspecified)` | DMA / memory-copy geometry parameter. *inferred* |
| `DmaDstStride` | `(unspecified)` | DMA / memory-copy geometry parameter. *inferred* |
| `BurstNumber` | `(unspecified)` | DMA / memory-copy geometry parameter. *inferred* |
| `CacheLineCount` | `(unspecified)` | Count / cardinality. *inferred* |
| `CacheLineUtilization` | `(unspecified)` | Utilization ratio or percent. *inferred* |
| `MemAccessStride` | `(unspecified)` | DMA / memory-copy geometry parameter. *inferred* |
| `ProcessedBytes` | `(unspecified)` | Size in bytes (or related unit). *inferred* |
| `MemoryTraffic` | `(unspecified)` | Memory-system related field. *inferred* |
| `VfSimtTidX` | `INTEGER` | Vector-function (VF) related field. *inferred* |
| `VfSimtTidY` | `INTEGER` | Vector-function (VF) related field. *inferred* |
| `VfSimtTidZ` | `INTEGER` | Vector-function (VF) related field. *inferred* |
| `VfSimtRegNum` | `INTEGER` | Register / SPR / predicate field. *inferred* |
| `BranchEfficiency` | `(unspecified)` | Efficiency / occupancy ratio. *inferred* |
| `WarpOccupancy` | `(unspecified)` | SIMT warp related field. *inferred* |
| `ScalarIPC` | `(unspecified)` | Instructions-per-cycle metric. *inferred* |
| `ExecIPC` | `(unspecified)` | Instructions-per-cycle metric. *inferred* |
| `LdStIPC` | `(unspecified)` | Instructions-per-cycle metric. *inferred* |
| `BranchIPC` | `(unspecified)` | Instructions-per-cycle metric. *inferred* |
| `MemoryStall` | `(unspecified)` | Stall cycles or stall-related counter. *inferred* |
| `ExecutionStall` | `(unspecified)` | Stall cycles or stall-related counter. *inferred* |
| `QueueFullStall` | `(unspecified)` | Stall cycles or stall-related counter. *inferred* |
| `Active` | `(unspecified)` | Sampling counter bucket. *inferred* |
| `Stall` | `(unspecified)` | Stall cycles or stall-related counter. *inferred* |
| `EmptyTicks` | `(unspecified)` | Simulation time in ticks. *inferred* |
| `SyncStall` | `(unspecified)` | Stall cycles or stall-related counter. *inferred* |
| `InstrFetchStall` | `(unspecified)` | Stall cycles or stall-related counter. *inferred* |
| `PipeActive` | `(unspecified)` | Queue or pipe related field. *inferred* |
| `SIMDStallsJson` | `TEXT` | Stall cycles or stall-related counter. *inferred* |

### `BasicBlockCountDiagram` {#basicblockcountdiagram}

| | |
|--|--|
| Kind | view |
| Gelu rows | 0 |
| CSV file | `BasicBlockCountDiagram.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `Name` | `VARCHAR(64)` | Human-readable name / label. *inferred* |
| `ExeCount` | `(unspecified)` | Count / cardinality. *inferred* |

### `IPCAsmMetrics` {#ipcasmmetrics}

| | |
|--|--|
| Kind | view |
| Gelu rows | 5381 |
| CSV file | `IPCAsmMetrics.csv` |
| Role | Per-instruction IPC components for assembly views. |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `ScalarIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `ExecIPC` | `(unspecified)` | Instructions-per-cycle metric. *inferred* |
| `LdStIPC` | `(unspecified)` | Instructions-per-cycle metric. *inferred* |
| `BranchIPC` | `(unspecified)` | Instructions-per-cycle metric. *inferred* |

### `InstrNameHistClocks` {#instrnamehistclocks}

| | |
|--|--|
| Kind | view |
| Gelu rows | 57 |
| CSV file | `InstrNameHistClocks.csv` |
| Role | Histogram aggregation view. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `Name` | `VARCHAR(100)` | Human-readable name / label. *inferred* |
| `TickCount` | `(unspecified)` | Simulation time in ticks. *inferred* |

### `InstrNameHistCount` {#instrnamehistcount}

| | |
|--|--|
| Kind | view |
| Gelu rows | 57 |
| CSV file | `InstrNameHistCount.csv` |
| Role | Histogram aggregation view. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `Name` | `VARCHAR(100)` | Human-readable name / label. *inferred* |
| `Count` | `(unspecified)` | Count / cardinality. *inferred* |

### `InstrTypeHistClocks` {#instrtypehistclocks}

| | |
|--|--|
| Kind | view |
| Gelu rows | 12 |
| CSV file | `InstrTypeHistClocks.csv` |
| Role | Histogram aggregation view. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `Type` | `VARCHAR(20)` | Human-readable name / label. *inferred* |
| `TickCount` | `(unspecified)` | Simulation time in ticks. *inferred* |

### `InstrTypeHistCount` {#instrtypehistcount}

| | |
|--|--|
| Kind | view |
| Gelu rows | 12 |
| CSV file | `InstrTypeHistCount.csv` |
| Role | Histogram aggregation view. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `Type` | `VARCHAR(20)` | Human-readable name / label. *inferred* |
| `Count` | `(unspecified)` | Count / cardinality. *inferred* |

### `InstructionHintsView` {#instructionhintsview}

| | |
|--|--|
| Kind | view |
| Gelu rows | 0 |
| CSV file | `InstructionHintsView.csv` |
| Role | Derived view over base contract tables. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `PC` | `INTEGER` | Program counter. *inferred* |
| `HintTypeId` | `INTEGER` | Identifier for `HintType`. *inferred* |
| `FileId` | `INTEGER` | Identifier for `File`. *inferred* |
| `LineId` | `INTEGER` | Identifier for `Line`. *inferred* |
| `LineNum` | `INTEGER` | Source line number or id. *inferred* |
| `HintMsgText` | `VARCHAR(500)` | Compiler / analyzer hint field. *inferred* |

### `PipeUtilizationHist` {#pipeutilizationhist}

| | |
|--|--|
| Kind | view |
| Gelu rows | 24 |
| CSV file | `PipeUtilizationHist.csv` |
| Role | Pipe utilization histogram by pipe and core display names. |

| Column | Type | Description |
|--------|------|-------------|
| `PipeName` | `VARCHAR(20)` | Human-readable name / label. *inferred* |
| `CoreName` | `VARCHAR(20)` | Human-readable name / label. *inferred* |
| `Utilization` | `(unspecified)` | Utilization ratio or percent. *inferred* |

### `SIMTGMPatterns` {#simtgmpatterns}

| | |
|--|--|
| Kind | view |
| Gelu rows | 0 |
| CSV file | `SIMTGMPatterns.csv` |
| Role | SIMD/SIMT sampling or execution metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `ThreadId` | `(unspecified)` | Identifier for `Thread`. *inferred* |
| `RegIndex` | `INTEGER` | Register / SPR / predicate field. *inferred* |
| `ProcessedAddress` | `INTEGER` | Memory or instruction address. *inferred* |
| `Mask` | `INTEGER` | Bitmask / predicate / lane mask. *inferred* |

### `SIMTSharedPatterns` {#simtsharedpatterns}

| | |
|--|--|
| Kind | view |
| Gelu rows | 0 |
| CSV file | `SIMTSharedPatterns.csv` |
| Role | SIMD/SIMT sampling or execution metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `InstrName` | `VARCHAR(100)` | Human-readable name / label. *inferred* |
| `ThreadId` | `(unspecified)` | Identifier for `Thread`. *inferred* |
| `Mask` | `INTEGER` | Bitmask / predicate / lane mask. *inferred* |
| `ProcessedAddress` | `INTEGER` | Memory or instruction address. *inferred* |

### `SharedPatterns` {#sharedpatterns}

| | |
|--|--|
| Kind | view |
| Gelu rows | 34832 |
| CSV file | `SharedPatterns.csv` |
| Role | View joining executed instructions to shared / pattern addresses. |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `InstrName` | `VARCHAR(100)` | Human-readable name / label. *inferred* |
| `AccessedAddress` | `INTEGER` | Memory or instruction address. *inferred* |

### `SourceLineHintsView` {#sourcelinehintsview}

| | |
|--|--|
| Kind | view |
| Gelu rows | 0 |
| CSV file | `SourceLineHintsView.csv` |
| Role | Derived view over base contract tables. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `FileId` | `INTEGER` | Identifier for `File`. *inferred* |
| `LineNum` | `INTEGER` | Source line number or id. *inferred* |
| `HintMsgText` | `VARCHAR(500)` | Compiler / analyzer hint field. *inferred* |

### `SourceLineMetrics` {#sourcelinemetrics}

| | |
|--|--|
| Kind | view |
| Gelu rows | 0 |
| CSV file | `SourceLineMetrics.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `DebugInfoId` | `INTEGER` | Identifier for `DebugInfo`. *inferred* |
| `FileId` | `INTEGER` | Identifier for `File`. *inferred* |
| `LineId` | `INTEGER` | Identifier for `Line`. *inferred* |
| `LineNum` | `INTEGER` | Source line number or id. *inferred* |
| `ExecutionCount` | `(unspecified)` | Count / cardinality. *inferred* |
| `TickCount` | `(unspecified)` | Simulation time in ticks. *inferred* |
| `RelTime` | `(unspecified)` | Time stamp or duration (ticks unless noted). *inferred* |
| `UBBankConflicts` | `(unspecified)` | Bank / resource conflict counter. *inferred* |
| `UBCrossInstructionBankConflicts` | `(unspecified)` | Bank / resource conflict counter. *inferred* |
| `VectorUtilization` | `(unspecified)` | Utilization ratio or percent. *inferred* |
| `DmaSrcStride` | `(unspecified)` | DMA / memory-copy geometry parameter. *inferred* |
| `DmaDstStride` | `(unspecified)` | DMA / memory-copy geometry parameter. *inferred* |
| `BurstNumber` | `(unspecified)` | DMA / memory-copy geometry parameter. *inferred* |
| `CacheLineCount` | `(unspecified)` | Count / cardinality. *inferred* |
| `CacheLineUtilization` | `(unspecified)` | Utilization ratio or percent. *inferred* |
| `MemAccessStride` | `(unspecified)` | DMA / memory-copy geometry parameter. *inferred* |
| `LiveGPRegisters` | `(unspecified)` | Register / SPR / predicate field. *inferred* |
| `LiveSharedRegisters` | `(unspecified)` | Register / SPR / predicate field. *inferred* |
| `ProcessedBytes` | `(unspecified)` | Size in bytes (or related unit). *inferred* |
| `MemoryTraffic` | `(unspecified)` | Memory-system related field. *inferred* |
| `BranchEfficiency` | `(unspecified)` | Efficiency / occupancy ratio. *inferred* |
| `WarpOccupancy` | `(unspecified)` | SIMT warp related field. *inferred* |
| `Active` | `(unspecified)` | Sampling counter bucket. *inferred* |
| `Stall` | `(unspecified)` | Stall cycles or stall-related counter. *inferred* |
| `EmptyTicks` | `(unspecified)` | Simulation time in ticks. *inferred* |
| `MemoryStall` | `(unspecified)` | Stall cycles or stall-related counter. *inferred* |
| `ExecutionStall` | `(unspecified)` | Stall cycles or stall-related counter. *inferred* |
| `QueueFullStall` | `(unspecified)` | Stall cycles or stall-related counter. *inferred* |
| `SyncStall` | `(unspecified)` | Stall cycles or stall-related counter. *inferred* |
| `InstrFetchStall` | `(unspecified)` | Stall cycles or stall-related counter. *inferred* |
| `PipeActive` | `(unspecified)` | Queue or pipe related field. *inferred* |
| `SIMDStallsJson` | `TEXT` | Stall cycles or stall-related counter. *inferred* |

### `VfIPCDynamicView` {#vfipcdynamicview}

| | |
|--|--|
| Kind | view |
| Gelu rows | 1216 |
| CSV file | `VfIPCDynamicView.csv` |
| Role | Vector-function (VF) metrics or metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `WindowStartTick` | `INTEGER` | Simulation time in ticks. *inferred* |
| `ScalarIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `ExecIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `LdStIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |

### `VfPMUDeltasViewPerVf` {#vfpmudeltasviewpervf}

| | |
|--|--|
| Kind | view |
| Gelu rows | 6880 |
| CSV file | `VfPMUDeltasViewPerVf.csv` |
| Role | Vector-function (VF) metrics or metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `VfId` | `INTEGER` | Identifier for `Vf`. *inferred* |
| `MetricId` | `INTEGER` | Identifier for `Metric`. *inferred* |
| `MetricName` | `VARCHAR(50)` | Human-readable name / label. *inferred* |
| `MetricDelta` | `(unspecified)` | PMU / metric identifier or value. *inferred* |

### `VfPMUSynthViewPerSubcore` {#vfpmusynthviewpersubcore}

| | |
|--|--|
| Kind | view |
| Gelu rows | 0 |
| CSV file | `VfPMUSynthViewPerSubcore.csv` |
| Role | Vector-function (VF) metrics or metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `SynthId` | `INTEGER` | Identifier for `Synth`. *inferred* |
| `SynthName` | `VARCHAR(64)` | Human-readable name / label. *inferred* |
| `SynthParentId` | `INTEGER` | Identifier for `SynthParent`. *inferred* |
| `SynthParentName` | `VARCHAR(64)` | Human-readable name / label. *inferred* |
| `SynthLevel` | `INTEGER` | Synthetic PMU metric field. *inferred* |
| `SynthValue` | `REAL` | Synthetic PMU metric field. *inferred* |

### `VfPMUSynthViewPerVf` {#vfpmusynthviewpervf}

| | |
|--|--|
| Kind | view |
| Gelu rows | 0 |
| CSV file | `VfPMUSynthViewPerVf.csv` |
| Role | Vector-function (VF) metrics or metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `VfId` | `INTEGER` | Identifier for `Vf`. *inferred* |
| `SynthId` | `INTEGER` | Identifier for `Synth`. *inferred* |
| `SynthName` | `VARCHAR(64)` | Human-readable name / label. *inferred* |
| `SynthParentId` | `INTEGER` | Identifier for `SynthParent`. *inferred* |
| `SynthParentName` | `VARCHAR(64)` | Human-readable name / label. *inferred* |
| `SynthLevel` | `INTEGER` | Synthetic PMU metric field. *inferred* |
| `SynthValue` | `REAL` | Synthetic PMU metric field. *inferred* |

### `VfPMUViewPerSubcore` {#vfpmuviewpersubcore}

| | |
|--|--|
| Kind | view |
| Gelu rows | 430 |
| CSV file | `VfPMUViewPerSubcore.csv` |
| Role | Vector-function (VF) metrics or metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `MetricId` | `INTEGER` | Identifier for `Metric`. *inferred* |
| `MetricName` | `VARCHAR(50)` | Human-readable name / label. *inferred* |
| `MetricValue` | `INTEGER` | PMU / metric identifier or value. *inferred* |

### `VfSimtIPCDynamicView` {#vfsimtipcdynamicview}

| | |
|--|--|
| Kind | view |
| Gelu rows | 0 |
| CSV file | `VfSimtIPCDynamicView.csv` |
| Role | Vector-function (VF) metrics or metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `WindowStartTick` | `INTEGER` | Simulation time in ticks. *inferred* |
| `ExecIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `LdStIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `BranchIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |

## Naming / type notes

- **Ticks vs µs.** Contract tables use integer **ticks**. Product `PipeTrace.json` must be packed in **µs** ([DATA-46](../../context/decisions/DATA.md)).
- **Types** are SQLite/export declarations (`INTEGER`, `REAL`, `BOOLEAN`, `VARCHAR(n)`, `TEXT`, `FLOAT`). `(unspecified)` means the gelu export left `type` empty.
- **Hub join.** Most fact tables join on `ExecInstrId` → `ExecutedInstructions`.
- **Dictionaries.** `CoreTypes`, `InstrTypes`, `InstrQueueTypes`, `HintTypes`, and similar are name lookups; often present in DB but omitted from slim packs — see [TABLES.md](TABLES.md).
- **ELF / flag gated.** Call*, Source*, Functions, DebugInfo, BasicBlocks, many SIMT/VfSimt*, TraceBubble* stay at 0 rows unless analyzers / `--object-file` run.
