# `VfSimtIPCDynamicView.csv`

| | |
|--|--|
| **Contract object** | `VfSimtIPCDynamicView` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | view |
| Gelu rows | 0 |
| CSV file | `VfSimtIPCDynamicView.csv` |
| Role | Vector-function (VF) metrics or metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `WindowStartTick` | `INTEGER` | Simulation time in ticks. *inferred* |
| `ExecIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `LdStIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `BranchIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
