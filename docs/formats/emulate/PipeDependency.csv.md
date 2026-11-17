# `PipeDependency.csv`

| | |
|--|--|
| **Contract object** | `PipeDependency` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 118 |
| CSV file | `PipeDependency.csv` |
| Role | Pipe dependency / sync flow edges for tracing. |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `EventId` | `INTEGER` | Identifier for `Event`. *inferred* |
| `EventName` | `VARCHAR(50)` | Human-readable name / label. *inferred* |
| `FlowEnd` | `INTEGER` | Interval bound. *inferred* |
| `CategoryId` | `INTEGER` | Identifier for `Category`. *inferred* |
