# `ICacheEvents.csv`

| | |
|--|--|
| **Contract object** | `ICacheEvents` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 2547 |
| CSV file | `ICacheEvents.csv` |
| Role | Instruction-cache access events for tracing. |

| Column | Type | Description |
|--------|------|-------------|
| `ICacheEventId` | `INTEGER` | Identifier for `ICacheEvent`. *inferred* |
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `EventTimeTick` | `INTEGER` | Simulation time in ticks. *inferred* |
| `SourceInstrAddr` | `INTEGER` | Memory or instruction address. *inferred* |
| `EventSize` | `INTEGER` | Size in bytes (or related unit). *inferred* |
| `HitStatus` | `BOOLEAN` | Cache hit/miss related field. *inferred* |
| `ICacheEventType` | `INTEGER` | Event id, name, or timing field. *inferred* |
