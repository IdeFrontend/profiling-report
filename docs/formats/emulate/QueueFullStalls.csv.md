# `QueueFullStalls.csv`

| | |
|--|--|
| **Contract object** | `QueueFullStalls` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `QueueFullStalls.csv` |
| Role | Stall, queue-full, or bubble analysis. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `QueueFullStall` | `INTEGER` | Stall cycles or stall-related counter. *inferred* |
