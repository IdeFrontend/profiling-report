# `LiveRegisters.csv`

| | |
|--|--|
| **Contract object** | `LiveRegisters` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `LiveRegisters.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `LiveRegisterId` | `INTEGER` | Identifier for `LiveRegister`. *inferred* |
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `LiveGPRegisters` | `INTEGER` | Register / SPR / predicate field. *inferred* |
| `LiveSharedRegisters` | `INTEGER` | Register / SPR / predicate field. *inferred* |
