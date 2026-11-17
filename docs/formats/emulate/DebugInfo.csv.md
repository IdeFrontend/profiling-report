# `DebugInfo.csv`

| | |
|--|--|
| **Contract object** | `DebugInfo` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `DebugInfo.csv` |
| Role | ELF / source / call-graph metadata; often empty without `--object-file`. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `DebugInfoId` | `INTEGER` | Identifier for `DebugInfo`. *inferred* |
| `SourceLineId` | `INTEGER` | Identifier for `SourceLine`. *inferred* |
| `SourceFileId` | `INTEGER` | Identifier for `SourceFile`. *inferred* |
| `DebugInfoLineNum` | `INTEGER` | Source line number or id. *inferred* |
