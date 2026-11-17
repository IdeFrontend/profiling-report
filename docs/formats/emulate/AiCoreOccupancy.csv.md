# `AiCoreOccupancy.csv`

| | |
|--|--|
| **Contract object** | `AiCoreOccupancy` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | view |
| Gelu rows | 3 |
| CSV file | `AiCoreOccupancy.csv` |
| Role | AICore busy intervals for occupancy overlay (MHTML §11.2.3.3). |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `TickStart` | `(unspecified)` | Simulation time in ticks. *inferred* |
| `TickEnd` | `(unspecified)` | Simulation time in ticks. *inferred* |
