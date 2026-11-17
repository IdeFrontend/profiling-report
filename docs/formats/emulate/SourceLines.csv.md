# `SourceLines.csv`

| | |
|--|--|
| **Contract object** | `SourceLines` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `SourceLines.csv` |
| Role | ELF / source / call-graph metadata; often empty without `--object-file`. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `SourceLineId` | `INTEGER` | Identifier for `SourceLine`. *inferred* |
| `SourceLine` | `VARCHAR(200)` | Source line number or id. *inferred* |
