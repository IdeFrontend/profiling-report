# `VfPMUSummary.csv`

| | |
|--|--|
| **Contract object** | `VfPMUSummary` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 32 |
| CSV file | `VfPMUSummary.csv` |
| Role | Vector-function (VF) metrics or metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `VfId` | `INTEGER` | Identifier for `Vf`. *inferred* |
| `VfKernelTicks` | `INTEGER` | Simulation time in ticks. *inferred* |
| `VfSystemTicks` | `INTEGER` | Simulation time in ticks. *inferred* |
