# `SIMTGMPatterns.csv`

| | |
|--|--|
| **Contract object** | `SIMTGMPatterns` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | view |
| Gelu rows | 0 |
| CSV file | `SIMTGMPatterns.csv` |
| Role | SIMD/SIMT sampling or execution metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `ThreadId` | `(unspecified)` | Identifier for `Thread`. *inferred* |
| `RegIndex` | `INTEGER` | Register / SPR / predicate field. *inferred* |
| `ProcessedAddress` | `INTEGER` | Memory or instruction address. *inferred* |
| `Mask` | `INTEGER` | Bitmask / predicate / lane mask. *inferred* |
