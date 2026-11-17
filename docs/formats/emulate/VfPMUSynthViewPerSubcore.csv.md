# `VfPMUSynthViewPerSubcore.csv`

| | |
|--|--|
| **Contract object** | `VfPMUSynthViewPerSubcore` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | view |
| Gelu rows | 0 |
| CSV file | `VfPMUSynthViewPerSubcore.csv` |
| Role | Vector-function (VF) metrics or metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `SynthId` | `INTEGER` | Identifier for `Synth`. *inferred* |
| `SynthName` | `VARCHAR(64)` | Human-readable name / label. *inferred* |
| `SynthParentId` | `INTEGER` | Identifier for `SynthParent`. *inferred* |
| `SynthParentName` | `VARCHAR(64)` | Human-readable name / label. *inferred* |
| `SynthLevel` | `INTEGER` | Synthetic PMU metric field. *inferred* |
| `SynthValue` | `REAL` | Synthetic PMU metric field. *inferred* |
