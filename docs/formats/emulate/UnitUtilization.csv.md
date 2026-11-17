# `UnitUtilization.csv`

| | |
|--|--|
| **Contract object** | `UnitUtilization` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

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
