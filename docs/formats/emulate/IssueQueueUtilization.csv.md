# `IssueQueueUtilization.csv`

| | |
|--|--|
| **Contract object** | `IssueQueueUtilization` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

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
