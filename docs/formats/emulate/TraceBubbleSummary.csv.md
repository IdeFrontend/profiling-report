# `TraceBubbleSummary.csv`

| | |
|--|--|
| **Contract object** | `TraceBubbleSummary` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `TraceBubbleSummary.csv` |
| Role | Stall, queue-full, or bubble analysis. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `MainPipeline` | `TEXT` | Queue or pipe related field. *inferred* |
| `TotalDurationUs` | `REAL` | Duration (ticks or µs per producer). *inferred* |
| `BubbleCount` | `INTEGER` | Count / cardinality. *inferred* |
| `TopBottleneck` | `TEXT` | Trace bubble / idle-gap analysis field. *inferred* |
| `SubtypeSummary` | `TEXT` | Classification / category label. *inferred* |
