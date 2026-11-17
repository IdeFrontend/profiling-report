# `PipesUtilization.csv`

| | |
|--|--|
| **Contract object** | `PipesUtilization` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

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
