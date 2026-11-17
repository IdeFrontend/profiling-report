# `VfSimtIPC.csv`

| | |
|--|--|
| **Contract object** | `VfSimtIPC` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `VfSimtIPC.csv` |
| Role | SIMT VF IPC aggregates. |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `ExecIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `LdStIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `BranchIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
