# `SyncStalls.csv`

| | |
|--|--|
| **Contract object** | `SyncStalls` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `SyncStalls.csv` |
| Role | Stall, queue-full, or bubble analysis. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `SyncStall` | `INTEGER` | Stall cycles or stall-related counter. *inferred* |
