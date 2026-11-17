# `ICacheStartingPCs.csv`

| | |
|--|--|
| **Contract object** | `ICacheStartingPCs` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 3 |
| CSV file | `ICacheStartingPCs.csv` |
| Role | Cache event / refill telemetry. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `StartingPC` | `INTEGER` | Program counter. *inferred* |
