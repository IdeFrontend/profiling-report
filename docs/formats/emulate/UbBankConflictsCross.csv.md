# `UbBankConflictsCross.csv`

| | |
|--|--|
| **Contract object** | `UbBankConflictsCross` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `UbBankConflictsCross.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `ConflictInstrs` | `VARCHAR(64)` | Bank / resource conflict counter. *inferred* |
| `ConflictCount` | `INTEGER` | Count / cardinality. *inferred* |
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
