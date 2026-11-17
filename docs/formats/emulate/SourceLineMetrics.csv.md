# `SourceLineMetrics.csv`

| | |
|--|--|
| **Contract object** | `SourceLineMetrics` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

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
