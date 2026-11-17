# `VectorUtilizations.csv`

| | |
|--|--|
| **Contract object** | `VectorUtilizations` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 480 |
| CSV file | `VectorUtilizations.csv` |
| Role | Vector unit bytes/elements/utilization for roofline-style views. |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `ProcessedBytes` | `INTEGER` | Size in bytes (or related unit). *inferred* |
| `ProcessedElements` | `INTEGER` | Work processed (bytes or elements). *inferred* |
| `VectorUtilization` | `REAL` | Utilization ratio or percent. *inferred* |
