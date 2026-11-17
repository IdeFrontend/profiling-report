# `UnitsUsageMetrics.csv`

| | |
|--|--|
| **Contract object** | `UnitsUsageMetrics` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 924 |
| CSV file | `UnitsUsageMetrics.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `SourceInstrAddr` | `INTEGER` | Memory or instruction address. *inferred* |
| `UniqueSubCoresUsed` | `INTEGER` | Cardinality of unique resources used. *inferred* |
| `UniqueWarpsUsed` | `INTEGER` | SIMT warp related field. *inferred* |
