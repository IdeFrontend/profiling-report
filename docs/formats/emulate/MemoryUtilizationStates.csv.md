# `MemoryUtilizationStates.csv`

| | |
|--|--|
| **Contract object** | `MemoryUtilizationStates` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

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
