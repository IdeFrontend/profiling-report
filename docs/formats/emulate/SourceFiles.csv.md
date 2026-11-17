# `SourceFiles.csv`

| | |
|--|--|
| **Contract object** | `SourceFiles` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `SourceFiles.csv` |
| Role | ELF / source / call-graph metadata; often empty without `--object-file`. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `SourceFileId` | `INTEGER` | Identifier for `SourceFile`. *inferred* |
| `SourceFilePath` | `VARCHAR(200)` | Source file path or id. *inferred* |
