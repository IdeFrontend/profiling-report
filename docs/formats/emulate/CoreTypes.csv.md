# `CoreTypes.csv`

| | |
|--|--|
| **Contract object** | `CoreTypes` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 3 |
| CSV file | `CoreTypes.csv` |
| Role | Dictionary of core type id → name. |

| Column | Type | Description |
|--------|------|-------------|
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `CoreTypeName` | `VARCHAR(20)` | Human-readable name / label. *inferred* |
