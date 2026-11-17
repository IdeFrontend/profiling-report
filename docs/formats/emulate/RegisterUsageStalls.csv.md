# `RegisterUsageStalls.csv`

| | |
|--|--|
| **Contract object** | `RegisterUsageStalls` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `RegisterUsageStalls.csv` |
| Role | Stall, queue-full, or bubble analysis. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `Memory` | `INTEGER` | Memory-system related field. *inferred* |
| `Execution` | `INTEGER` | Execution count or execution stall bucket. *inferred* |
