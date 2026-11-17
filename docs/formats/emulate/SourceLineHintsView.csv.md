# `SourceLineHintsView.csv`

| | |
|--|--|
| **Contract object** | `SourceLineHintsView` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | view |
| Gelu rows | 0 |
| CSV file | `SourceLineHintsView.csv` |
| Role | Derived view over base contract tables. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `FileId` | `INTEGER` | Identifier for `File`. *inferred* |
| `LineNum` | `INTEGER` | Source line number or id. *inferred* |
| `HintMsgText` | `VARCHAR(500)` | Compiler / analyzer hint field. *inferred* |
