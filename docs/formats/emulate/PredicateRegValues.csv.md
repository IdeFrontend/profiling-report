# `PredicateRegValues.csv`

| | |
|--|--|
| **Contract object** | `PredicateRegValues` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 640 |
| CSV file | `PredicateRegValues.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `PredRegIndex` | `INTEGER` | Register / SPR / predicate field. *inferred* |
| `PredRegLenBits` | `INTEGER` | Register / SPR / predicate field. *inferred* |
| `PredRegValue` | `VARCHAR(80)` | Register / SPR / predicate field. *inferred* |
