# `CallFunctions.csv`

| | |
|--|--|
| **Contract object** | `CallFunctions` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `CallFunctions.csv` |
| Role | ELF / source / call-graph metadata; often empty without `--object-file`. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CallFunctionId` | `INTEGER` | Identifier for `CallFunction`. *inferred* |
| `SourceFileId` | `INTEGER` | Identifier for `SourceFile`. *inferred* |
| `FunctionName` | `VARCHAR(128)` | Human-readable name / label. *inferred* |
