# `DCacheHitMissEvents.csv`

| | |
|--|--|
| **Contract object** | `DCacheHitMissEvents` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `DCacheHitMissEvents.csv` |
| Role | Cache event / refill telemetry. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `EventId` | `INTEGER` | Identifier for `Event`. *inferred* |
| `SourceInstrAddr` | `INTEGER` | Memory or instruction address. *inferred* |
| `CacheLineAddress` | `INTEGER` | Memory or instruction address. *inferred* |
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `IsHit` | `BOOLEAN` | Boolean flag. *inferred* |
| `EventTick` | `INTEGER` | Simulation time in ticks. *inferred* |
