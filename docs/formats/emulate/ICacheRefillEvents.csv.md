# `ICacheRefillEvents.csv`

| | |
|--|--|
| **Contract object** | `ICacheRefillEvents` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 11 |
| CSV file | `ICacheRefillEvents.csv` |
| Role | Cache event / refill telemetry. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `EventId` | `INTEGER` | Identifier for `Event`. *inferred* |
| `SourceInstrAddr` | `INTEGER` | Memory or instruction address. *inferred* |
| `ICacheEventType` | `INTEGER` | Event id, name, or timing field. *inferred* |
| `CacheLineSize` | `INTEGER` | Size in bytes (or related unit). *inferred* |
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `EventBeginTick` | `INTEGER` | Simulation time in ticks. *inferred* |
| `EventEndTick` | `INTEGER` | Simulation time in ticks. *inferred* |
