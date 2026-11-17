# `SIMTSharedPatterns.csv`

| | |
|--|--|
| **Contract object** | `SIMTSharedPatterns` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | view |
| Gelu rows | 0 |
| CSV file | `SIMTSharedPatterns.csv` |
| Role | SIMD/SIMT sampling or execution metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `InstrName` | `VARCHAR(100)` | Human-readable name / label. *inferred* |
| `ThreadId` | `(unspecified)` | Identifier for `Thread`. *inferred* |
| `Mask` | `INTEGER` | Bitmask / predicate / lane mask. *inferred* |
| `ProcessedAddress` | `INTEGER` | Memory or instruction address. *inferred* |
