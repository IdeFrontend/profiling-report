# `PMUScalarCounters.csv`

| | |
|--|--|
| **Contract object** | `PMUScalarCounters` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 141 |
| CSV file | `PMUScalarCounters.csv` |
| Role | Performance / utilization telemetry. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `CounterName` | `VARCHAR(64)` | Human-readable name / label. *inferred* |
| `CounterValue` | `INTEGER` | Count / cardinality. *inferred* |
