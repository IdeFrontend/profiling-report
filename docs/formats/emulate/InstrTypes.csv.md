# `InstrTypes.csv`

| | |
|--|--|
| **Contract object** | `InstrTypes` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 15 |
| CSV file | `InstrTypes.csv` |
| Role | Dictionary of instruction type id → name. |

| Column | Type | Description |
|--------|------|-------------|
| `InstrTypeId` | `INTEGER` | FK → InstrTypes. *inferred* |
| `InstrTypeName` | `VARCHAR(20)` | Human-readable name / label. *inferred* |
