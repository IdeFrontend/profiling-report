# `PipeUtilizationHist.csv`

| | |
|--|--|
| **Contract object** | `PipeUtilizationHist` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | view |
| Gelu rows | 24 |
| CSV file | `PipeUtilizationHist.csv` |
| Role | Pipe utilization histogram by pipe and core display names. |

| Column | Type | Description |
|--------|------|-------------|
| `PipeName` | `VARCHAR(20)` | Human-readable name / label. *inferred* |
| `CoreName` | `VARCHAR(20)` | Human-readable name / label. *inferred* |
| `Utilization` | `(unspecified)` | Utilization ratio or percent. *inferred* |
