# `VfSimtIPCDynamic.csv`

| | |
|--|--|
| **Contract object** | `VfSimtIPCDynamic` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `VfSimtIPCDynamic.csv` |
| Role | Vector-function (VF) metrics or metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `WindowStartTick` | `INTEGER` | Simulation time in ticks. *inferred* |
| `ExecIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `LdStIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `BranchIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
