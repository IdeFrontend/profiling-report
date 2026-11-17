# `DmaMovSimpleParams.csv`

| | |
|--|--|
| **Contract object** | `DmaMovSimpleParams` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 32 |
| CSV file | `DmaMovSimpleParams.csv` |
| Role | DMA-move parameters or traffic. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `BurstLength` | `INTEGER` | DMA / memory-copy geometry parameter. *inferred* |
| `BurstNumber` | `INTEGER` | DMA / memory-copy geometry parameter. *inferred* |
| `SrcStride` | `INTEGER` | DMA / memory-copy geometry parameter. *inferred* |
| `DstStride` | `INTEGER` | DMA / memory-copy geometry parameter. *inferred* |
| `SubBlockId` | `INTEGER` | Identifier for `SubBlock`. *inferred* |
