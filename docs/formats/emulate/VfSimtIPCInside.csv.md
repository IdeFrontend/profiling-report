# `VfSimtIPCInside.csv`

| | |
|--|--|
| **Contract object** | `VfSimtIPCInside` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `VfSimtIPCInside.csv` |
| Role | Vector-function (VF) metrics or metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `ExecIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `LdStIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `BranchIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
