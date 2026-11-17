# `SprInfoPerInstr.csv`

| | |
|--|--|
| **Contract object** | `SprInfoPerInstr` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 2014 |
| CSV file | `SprInfoPerInstr.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `SprName` | `VARCHAR(20)` | Human-readable name / label. *inferred* |
| `SprValue` | `VARCHAR(20)` | Register / SPR / predicate field. *inferred* |
