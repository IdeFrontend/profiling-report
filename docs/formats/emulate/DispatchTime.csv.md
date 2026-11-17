# `DispatchTime.csv`

| | |
|--|--|
| **Contract object** | `DispatchTime` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 4265 |
| CSV file | `DispatchTime.csv` |
| Role | Dispatch tick per executed instruction (Chrome Trace dispatch). |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `DispatchTimeTick` | `INTEGER` | Simulation time in ticks. *inferred* |
