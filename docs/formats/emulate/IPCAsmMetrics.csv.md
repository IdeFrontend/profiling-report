# `IPCAsmMetrics.csv`

| | |
|--|--|
| **Contract object** | `IPCAsmMetrics` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | view |
| Gelu rows | 1248 |
| CSV file | `IPCAsmMetrics.csv` |
| Role | Per-instruction IPC components for assembly views. |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `ScalarIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `ExecIPC` | `(unspecified)` | Instructions-per-cycle metric. *inferred* |
| `LdStIPC` | `(unspecified)` | Instructions-per-cycle metric. *inferred* |
| `BranchIPC` | `(unspecified)` | Instructions-per-cycle metric. *inferred* |
