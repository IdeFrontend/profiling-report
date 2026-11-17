# `SIMTGmAccessMetrics.csv`

| | |
|--|--|
| **Contract object** | `SIMTGmAccessMetrics` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `SIMTGmAccessMetrics.csv` |
| Role | SIMD/SIMT sampling or execution metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `CacheLineCount` | `INTEGER` | Count / cardinality. *inferred* |
| `CacheLineUtilization` | `REAL` | Utilization ratio or percent. *inferred* |
| `MemAccessStride` | `INTEGER` | DMA / memory-copy geometry parameter. *inferred* |
