# `VfIPCDynamic.csv`

| | |
|--|--|
| **Contract object** | `VfIPCDynamic` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 1216 |
| CSV file | `VfIPCDynamic.csv` |
| Role | Time-windowed VF IPC samples. |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `WindowStartTick` | `INTEGER` | Simulation time in ticks. *inferred* |
| `ScalarIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `ExecIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `LdStIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
