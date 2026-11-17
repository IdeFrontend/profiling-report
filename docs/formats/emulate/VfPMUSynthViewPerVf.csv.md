# `VfPMUSynthViewPerVf.csv`

| | |
|--|--|
| **Contract object** | `VfPMUSynthViewPerVf` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | view |
| Gelu rows | 0 |
| CSV file | `VfPMUSynthViewPerVf.csv` |
| Role | Vector-function (VF) metrics or metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `VfId` | `INTEGER` | Identifier for `Vf`. *inferred* |
| `SynthId` | `INTEGER` | Identifier for `Synth`. *inferred* |
| `SynthName` | `VARCHAR(64)` | Human-readable name / label. *inferred* |
| `SynthParentId` | `INTEGER` | Identifier for `SynthParent`. *inferred* |
| `SynthParentName` | `VARCHAR(64)` | Human-readable name / label. *inferred* |
| `SynthLevel` | `INTEGER` | Synthetic PMU metric field. *inferred* |
| `SynthValue` | `REAL` | Synthetic PMU metric field. *inferred* |
