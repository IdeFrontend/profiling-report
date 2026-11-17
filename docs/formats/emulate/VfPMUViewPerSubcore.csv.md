# `VfPMUViewPerSubcore.csv`

| | |
|--|--|
| **Contract object** | `VfPMUViewPerSubcore` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | view |
| Gelu rows | 430 |
| CSV file | `VfPMUViewPerSubcore.csv` |
| Role | Vector-function (VF) metrics or metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `MetricId` | `INTEGER` | Identifier for `Metric`. *inferred* |
| `MetricName` | `VARCHAR(50)` | Human-readable name / label. *inferred* |
| `MetricValue` | `INTEGER` | PMU / metric identifier or value. *inferred* |
