# `SIMTExecutionMasks.csv`

| | |
|--|--|
| **Contract object** | `SIMTExecutionMasks` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `SIMTExecutionMasks.csv` |
| Role | SIMD/SIMT sampling or execution metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `PredicateMask` | `INTEGER` | Bitmask / predicate / lane mask. *inferred* |
| `ExecutionMask` | `INTEGER` | Bitmask / predicate / lane mask. *inferred* |
| `FullMask` | `INTEGER` | Bitmask / predicate / lane mask. *inferred* |
| `BranchEfficiency` | `FLOAT` | Efficiency / occupancy ratio. *inferred* |
