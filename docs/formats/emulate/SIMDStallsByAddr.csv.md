# `SIMDStallsByAddr.csv`

| | |
|--|--|
| **Contract object** | `SIMDStallsByAddr` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 8 |
| CSV file | `SIMDStallsByAddr.csv` |
| Role | SIMD/SIMT sampling or execution metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `SourceInstrAddr` | `INTEGER` | Memory or instruction address. *inferred* |
| `StallsJson` | `TEXT` | Stall cycles or stall-related counter. *inferred* |
