# `BrifEvents.csv`

| | |
|--|--|
| **Contract object** | `BrifEvents` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 64 |
| CSV file | `BrifEvents.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `EventType` | `INTEGER` | Event id, name, or timing field. *inferred* |
| `EventTick` | `INTEGER` | Simulation time in ticks. *inferred* |
| `MteInstrId` | `INTEGER` | Identifier for `MteInstr`. *inferred* |
| `PackageAddr` | `VARCHAR(20)` | Memory or instruction address. *inferred* |
| `TagId` | `INTEGER` | Identifier for `Tag`. *inferred* |
| `GroupId` | `INTEGER` | Identifier for `Group`. *inferred* |
