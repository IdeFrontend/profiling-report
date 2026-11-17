# `CallStackIDs.csv`

| | |
|--|--|
| **Contract object** | `CallStackIDs` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `CallStackIDs.csv` |
| Role | ELF / source / call-graph metadata; often empty without `--object-file`. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `SourceInstrAddr` | `INTEGER` | Memory or instruction address. *inferred* |
| `CallStackId` | `INTEGER` | Identifier for `CallStack`. *inferred* |
