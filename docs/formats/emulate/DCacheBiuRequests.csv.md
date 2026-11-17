# `DCacheBiuRequests.csv`

| | |
|--|--|
| **Contract object** | `DCacheBiuRequests` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `DCacheBiuRequests.csv` |
| Role | Cache event / refill telemetry. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `EventId` | `INTEGER` | Identifier for `Event`. *inferred* |
| `SourceInstrAddr` | `INTEGER` | Memory or instruction address. *inferred* |
| `RequestSize` | `INTEGER` | Size in bytes (or related unit). *inferred* |
| `CacheLineAddress` | `INTEGER` | Memory or instruction address. *inferred* |
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `EventBeginTick` | `INTEGER` | Simulation time in ticks. *inferred* |
| `EventEndTick` | `INTEGER` | Simulation time in ticks. *inferred* |
