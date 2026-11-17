# `UbRwAccesses.csv`

| | |
|--|--|
| **Contract object** | `UbRwAccesses` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 34832 |
| CSV file | `UbRwAccesses.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* Packed in gelu but **not** a heat source — §11.2.3.2 uses Layout+Cells ([DATA-50](../../context/decisions/DATA.md)). |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `AccessedAddress` | `INTEGER` | Memory or instruction address. *inferred* |
