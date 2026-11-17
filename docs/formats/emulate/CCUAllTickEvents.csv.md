# `CCUAllTickEvents.csv`

| | |
|--|--|
| **Contract object** | `CCUAllTickEvents` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

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
