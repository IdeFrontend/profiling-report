# `VFMemoryRWAccesses.csv`

| | |
|--|--|
| **Contract object** | `VFMemoryRWAccesses` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `VFMemoryRWAccesses.csv` |
| Role | Vector-function (VF) metrics or metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `AccessedAddress` | `INTEGER` | Memory or instruction address. *inferred* |
| `AccessMode` | `VARCHAR(1)` | Operating mode / enum string. *inferred* |
| `AccessTime` | `INTEGER` | Time stamp or duration (ticks unless noted). *inferred* |
| `MemoryType` | `INTEGER` | Memory-system related field. *inferred* |
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
