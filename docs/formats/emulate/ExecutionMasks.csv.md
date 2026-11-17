# `ExecutionMasks.csv`

| | |
|--|--|
| **Contract object** | `ExecutionMasks` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `ExecutionMasks.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecutionMaskId` | `INTEGER` | Identifier for `ExecutionMask`. *inferred* |
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `Mask` | `INTEGER` | Bitmask / predicate / lane mask. *inferred* |
