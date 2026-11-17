# `SIMDSamplingStats.csv`

| | |
|--|--|
| **Contract object** | `SIMDSamplingStats` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 256 |
| CSV file | `SIMDSamplingStats.csv` |
| Role | SIMD/SIMT sampling or execution metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `StallReasonId` | `INTEGER` | Identifier for `StallReason`. *inferred* |
| `StallCount` | `INTEGER` | Count / cardinality. *inferred* |
