# `SprWriteEvents.csv`

| | |
|--|--|
| **Contract object** | `SprWriteEvents` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 350 |
| CSV file | `SprWriteEvents.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `EventTick` | `INTEGER` | Simulation time in ticks. *inferred* |
| `SprName` | `VARCHAR(20)` | Human-readable name / label. *inferred* |
| `SprValue` | `VARCHAR(20)` | Register / SPR / predicate field. *inferred* |
