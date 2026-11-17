# `BasicBlocks.csv`

| | |
|--|--|
| **Contract object** | `BasicBlocks` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `BasicBlocks.csv` |
| Role | ELF / source / call-graph metadata; often empty without `--object-file`. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `SourceInstrAddr` | `INTEGER` | Memory or instruction address. *inferred* |
| `BBLength` | `INTEGER` | Basic-block related field. *inferred* |
| `BBName` | `VARCHAR(64)` | Human-readable name / label. *inferred* |
