# `Functions.csv`

| | |
|--|--|
| **Contract object** | `Functions` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `Functions.csv` |
| Role | Function symbols from ELF. |

| Column | Type | Description |
|--------|------|-------------|
| `SourceInstrAddr` | `INTEGER` | Memory or instruction address. *inferred* |
| `FunctionSize` | `INTEGER` | Size in bytes (or related unit). *inferred* |
| `FunctionName` | `VARCHAR(128)` | Human-readable name / label. *inferred* |
