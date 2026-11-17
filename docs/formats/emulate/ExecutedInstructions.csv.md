# `ExecutedInstructions.csv`

| | |
|--|--|
| **Contract object** | `ExecutedInstructions` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

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
