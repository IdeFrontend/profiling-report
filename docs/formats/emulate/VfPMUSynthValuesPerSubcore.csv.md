# `VfPMUSynthValuesPerSubcore.csv`

| | |
|--|--|
| **Contract object** | `VfPMUSynthValuesPerSubcore` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `VfPMUSynthValuesPerSubcore.csv` |
| Role | Vector-function (VF) metrics or metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `SynthId` | `INTEGER` | Identifier for `Synth`. *inferred* |
| `SynthValue` | `REAL` | Synthetic PMU metric field. *inferred* |
