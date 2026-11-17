# `AsmMetrics.csv`

| | |
|--|--|
| **Contract object** | `AsmMetrics` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

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
