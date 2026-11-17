# `FixpParams.csv`

| | |
|--|--|
| **Contract object** | `FixpParams` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `FixpParams.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `N` | `INTEGER` | Numeric shape parameter. *inferred* |
| `M` | `INTEGER` | Numeric shape parameter. *inferred* |
| `L2CacheCtrlMode` | `VARCHAR(50)` | Operating mode / enum string. *inferred* |
| `HwChecksUnitFlag` | `BOOLEAN` | Boolean flag. *inferred* |
| `HwSetsUnitFlag` | `BOOLEAN` | Boolean flag. *inferred* |
| `PreQuantMode` | `VARCHAR(100)` | Operating mode / enum string. *inferred* |
| `PreReluMode` | `VARCHAR(20)` | Operating mode / enum string. *inferred* |
| `PreClipReluMode` | `VARCHAR(30)` | Operating mode / enum string. *inferred* |
| `F32ChannelSplitEnable` | `BOOLEAN` | Purpose unclear; present in contract schema. *inferred* |
| `PostClipReluMode` | `VARCHAR(30)` | Operating mode / enum string. *inferred* |
| `PostReluMode` | `VARCHAR(20)` | Operating mode / enum string. *inferred* |
| `NZ2NDEnable` | `BOOLEAN` | Purpose unclear; present in contract schema. *inferred* |
| `NZ2DNEnable` | `BOOLEAN` | Purpose unclear; present in contract schema. *inferred* |
| `C0PaddingEnable` | `BOOLEAN` | Purpose unclear; present in contract schema. *inferred* |
| `DstMode` | `VARCHAR(50)` | Operating mode / enum string. *inferred* |
| `DstUBMask` | `INTEGER` | Bitmask / predicate / lane mask. *inferred* |
| `ProcessedBytes` | `INTEGER` | Size in bytes (or related unit). *inferred* |
