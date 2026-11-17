# `QueueFullEvents.csv`

| | |
|--|--|
| **Contract object** | `QueueFullEvents` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

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
