# `SubQueueTypes.csv`

| | |
|--|--|
| **Contract object** | `SubQueueTypes` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `SubQueueTypes.csv` |
| Role | Dictionary / enum lookup table. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `SubQueueType` | `INTEGER` | Queue or pipe related field. *inferred* |
