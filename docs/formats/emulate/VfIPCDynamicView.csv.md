# `VfIPCDynamicView.csv`

| | |
|--|--|
| **Contract object** | `VfIPCDynamicView` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | view |
| Gelu rows | 1216 |
| CSV file | `VfIPCDynamicView.csv` |
| Role | Vector-function (VF) metrics or metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `WindowStartTick` | `INTEGER` | Simulation time in ticks. *inferred* |
| `ScalarIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `ExecIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `LdStIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
