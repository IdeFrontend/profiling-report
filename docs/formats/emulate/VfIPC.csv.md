# `VfIPC.csv`

| | |
|--|--|
| **Contract object** | `VfIPC` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 32 |
| CSV file | `VfIPC.csv` |
| Role | Per-VF IPC aggregates (MHTML §11.2.3.7). |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `ScalarIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `ExecIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `LdStIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
