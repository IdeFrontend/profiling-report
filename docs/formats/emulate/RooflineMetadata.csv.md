# `RooflineMetadata.csv`

| | |
|--|--|
| **Contract object** | `RooflineMetadata` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |
| **View** | [roofline](../../views/roofline.md) |
| **Decision** | [DATA-57a](../../context/decisions/interim/DATA.md#data-57a) |

| | |
|--|--|
| Kind | table |
| Role | One-row snapshot: architecture id, frequencies, active/max core counts. |

| Column | Type | Description |
|--------|------|-------------|
| `AnalysisId` | `INTEGER` | Snapshot id (constrained to `1`). |
| `Architecture` | `TEXT` | e.g. `v100`. |
| `FrequencyGHz` | `REAL` | Recorded frequency (metadata). |
| `ReferenceFrequencyGHz` | `REAL` | Tick→seconds reference (currently `1.65`). |
| `ActiveCoreCount` | `INTEGER` | Distinct physical cores observed. |
| `MaxCoreCount` | `INTEGER` | Full-chip core count. |
| `ActiveAicCount` | `INTEGER` | Distinct cores with AIC instructions. |
| `ActiveAivCount` | `INTEGER` | Distinct (core, AIV subcore) pairs. |

Active counts do **not** scale stored reference ceilings.
