# `SIMDStallsByLine.csv`

| | |
|--|--|
| **Contract object** | `SIMDStallsByLine` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `SIMDStallsByLine.csv` |
| Role | SIMD/SIMT sampling or execution metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `SourceFileId` | `INTEGER` | Identifier for `SourceFile`. *inferred* |
| `DebugInfoLineNum` | `INTEGER` | Source line number or id. *inferred* |
| `StallsJson` | `TEXT` | Stall cycles or stall-related counter. *inferred* |
