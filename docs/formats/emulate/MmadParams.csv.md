# `MmadParams.csv`

| | |
|--|--|
| **Contract object** | `MmadParams` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `MmadParams.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `M` | `INTEGER` | Numeric shape parameter. *inferred* |
| `K` | `INTEGER` | Numeric shape parameter. *inferred* |
| `N` | `INTEGER` | Numeric shape parameter. *inferred* |
| `MatrixADtype` | `VARCHAR(16)` | Data type of a matrix/tensor operand. *inferred* |
| `MatrixBDtype` | `VARCHAR(16)` | Data type of a matrix/tensor operand. *inferred* |
| `MatrixCDtype` | `VARCHAR(16)` | Data type of a matrix/tensor operand. *inferred* |
| `EnabledMode` | `VARCHAR(16)` | Operating mode / enum string. *inferred* |
| `MatrixAL0AAddress` | `INTEGER` | Memory or instruction address. *inferred* |
| `MatrixBL0BAddress` | `INTEGER` | Memory or instruction address. *inferred* |
| `MatrixCAddress` | `INTEGER` | Memory or instruction address. *inferred* |
| `HwChecksUnitFlag` | `BOOLEAN` | Boolean flag. *inferred* |
| `HwSetsUnitFlag` | `BOOLEAN` | Boolean flag. *inferred* |
| `GEMVModeEnable` | `BOOLEAN` | Operating mode / enum string. *inferred* |
| `MatrixCInBiasTableBuffer` | `BOOLEAN` | Matrix operand attribute. *inferred* |
| `MatrixCInitVal` | `BOOLEAN` | Associated value. *inferred* |
| `MatrixAProcessedBytes` | `INTEGER` | Size in bytes (or related unit). *inferred* |
| `MatrixBProcessedBytes` | `INTEGER` | Size in bytes (or related unit). *inferred* |
| `MatrixCProcessedBytes` | `INTEGER` | Size in bytes (or related unit). *inferred* |
