# `UBBankConflicts.csv`

| | |
|--|--|
| **Contract object** | `UBBankConflicts` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `UBBankConflicts.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `UBBankConflictId` | `INTEGER` | Identifier for `UBBankConflict`. *inferred* |
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `ReadConflicts` | `INTEGER` | Bank / resource conflict counter. *inferred* |
| `WriteConflicts` | `INTEGER` | Bank / resource conflict counter. *inferred* |
