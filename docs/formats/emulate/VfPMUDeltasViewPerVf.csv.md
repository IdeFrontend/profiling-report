# `VfPMUDeltasViewPerVf.csv`

| | |
|--|--|
| **Contract object** | `VfPMUDeltasViewPerVf` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | view |
| Gelu rows | 6880 |
| CSV file | `VfPMUDeltasViewPerVf.csv` |
| Role | Vector-function (VF) metrics or metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `VfId` | `INTEGER` | Identifier for `Vf`. *inferred* |
| `MetricId` | `INTEGER` | Identifier for `Metric`. *inferred* |
| `MetricName` | `VARCHAR(50)` | Human-readable name / label. *inferred* |
| `MetricDelta` | `(unspecified)` | PMU / metric identifier or value. *inferred* |
