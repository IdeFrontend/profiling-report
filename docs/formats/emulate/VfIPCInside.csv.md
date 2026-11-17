# `VfIPCInside.csv`

| | |
|--|--|
| **Contract object** | `VfIPCInside` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 1216 |
| CSV file | `VfIPCInside.csv` |
| Role | In-VF IPC breakdown. |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `ScalarIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `ExecIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `LdStIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
