# `ScalarIpcDynamic.csv`

| | |
|--|--|
| **Contract object** | `ScalarIpcDynamic` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `ScalarIpcDynamic.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `Tick` | `INTEGER` | Simulation time in ticks. *inferred* |
| `IPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
