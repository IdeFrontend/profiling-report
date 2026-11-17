# `CallGraphMetrics.csv`

| | |
|--|--|
| **Contract object** | `CallGraphMetrics` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `CallGraphMetrics.csv` |
| Role | ELF / source / call-graph metadata; often empty without `--object-file`. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CallFunctionId` | `INTEGER` | Identifier for `CallFunction`. *inferred* |
| `SelfExecutionCount` | `INTEGER` | Count / cardinality. *inferred* |
| `SelfTickCount` | `INTEGER` | Simulation time in ticks. *inferred* |
| `TotalExecutionCount` | `INTEGER` | Count / cardinality. *inferred* |
| `TotalTickCount` | `INTEGER` | Simulation time in ticks. *inferred* |
