# `HintTypes.csv`

| | |
|--|--|
| **Contract object** | `HintTypes` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 10 |
| CSV file | `HintTypes.csv` |
| Role | Dictionary of performance-hint type id → name and pass flag. |

| Column | Type | Description |
|--------|------|-------------|
| `HintTypeId` | `INTEGER` | Identifier for `HintType`. *inferred* |
| `HintTypeName` | `VARCHAR(70)` | Human-readable name / label. *inferred* |
| `HintPassed` | `BOOLEAN` | Boolean flag. *inferred* |
