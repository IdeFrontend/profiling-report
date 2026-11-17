# `SIMTLdStProcessedBytes.csv`

| | |
|--|--|
| **Contract object** | `SIMTLdStProcessedBytes` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `SIMTLdStProcessedBytes.csv` |
| Role | SIMD/SIMT sampling or execution metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `ExecInstrName` | `VARCHAR(100)` | Human-readable name / label. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `ProcessedBytes` | `INTEGER` | Size in bytes (or related unit). *inferred* |
