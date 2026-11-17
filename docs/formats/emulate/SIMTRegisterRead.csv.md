# `SIMTRegisterRead.csv`

| | |
|--|--|
| **Contract object** | `SIMTRegisterRead` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `SIMTRegisterRead.csv` |
| Role | SIMD/SIMT sampling or execution metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `RegIndex` | `INTEGER` | Register / SPR / predicate field. *inferred* |
| `Bias` | `INTEGER` | Address bias / offset. *inferred* |
| `ProcessedAddress` | `INTEGER` | Memory or instruction address. *inferred* |
