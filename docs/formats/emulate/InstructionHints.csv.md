# `InstructionHints.csv`

| | |
|--|--|
| **Contract object** | `InstructionHints` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `InstructionHints.csv` |
| Role | Performance hints attached to an instruction PC. |

| Column | Type | Description |
|--------|------|-------------|
| `HintId` | `INTEGER` | Identifier for `Hint`. *inferred* |
| `HintTypeId` | `INTEGER` | Identifier for `HintType`. *inferred* |
| `HintMsgId` | `INTEGER` | Identifier for `HintMsg`. *inferred* |
| `PC` | `INTEGER` | Program counter. *inferred* |
