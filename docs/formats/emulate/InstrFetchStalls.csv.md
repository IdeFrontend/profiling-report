# `InstrFetchStalls.csv`

| | |
|--|--|
| **Contract object** | `InstrFetchStalls` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `InstrFetchStalls.csv` |
| Role | Stall, queue-full, or bubble analysis. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `InstrFetchStall` | `INTEGER` | Stall cycles or stall-related counter. *inferred* |
