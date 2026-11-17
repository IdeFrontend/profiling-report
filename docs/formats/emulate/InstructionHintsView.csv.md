# `InstructionHintsView.csv`

| | |
|--|--|
| **Contract object** | `InstructionHintsView` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | view |
| Gelu rows | 0 |
| CSV file | `InstructionHintsView.csv` |
| Role | Derived view over base contract tables. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `PC` | `INTEGER` | Program counter. *inferred* |
| `HintTypeId` | `INTEGER` | Identifier for `HintType`. *inferred* |
| `FileId` | `INTEGER` | Identifier for `File`. *inferred* |
| `LineId` | `INTEGER` | Identifier for `Line`. *inferred* |
| `LineNum` | `INTEGER` | Source line number or id. *inferred* |
| `HintMsgText` | `VARCHAR(500)` | Compiler / analyzer hint field. *inferred* |
