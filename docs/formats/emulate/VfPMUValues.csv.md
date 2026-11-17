# `VfPMUValues.csv`

| | |
|--|--|
| **Contract object** | `VfPMUValues` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 6880 |
| CSV file | `VfPMUValues.csv` |
| Role | Vector-function (VF) metrics or metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `VfId` | `INTEGER` | Identifier for `Vf`. *inferred* |
| `MetricId` | `INTEGER` | Identifier for `Metric`. *inferred* |
| `MetricValue` | `INTEGER` | PMU / metric identifier or value. *inferred* |
