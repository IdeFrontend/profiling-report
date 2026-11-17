# `SharedPatterns.csv`

| | |
|--|--|
| **Contract object** | `SharedPatterns` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | view |
| Gelu rows | 34832 |
| CSV file | `SharedPatterns.csv` |
| Role | View joining executed instructions to shared / pattern addresses. |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `InstrName` | `VARCHAR(100)` | Human-readable name / label. *inferred* |
| `AccessedAddress` | `INTEGER` | Memory or instruction address. *inferred* |
