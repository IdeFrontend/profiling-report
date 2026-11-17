# `MemoryRWAccesses.csv`

| | |
|--|--|
| **Contract object** | `MemoryRWAccesses` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 34832 |
| CSV file | `MemoryRWAccesses.csv` |
| Role | Per-access memory read/write events. Packed in gelu but **not** used for §11.2.3.2 heat — lattice SSOT is `MemoryHeatmapLayout` + `MemoryHeatmapCells` ([DATA-50](../../context/decisions/DATA.md)). |

| Column | Type | Description |
|--------|------|-------------|
| `AccessedAddress` | `INTEGER` | Memory or instruction address. *inferred* |
| `AccessMode` | `VARCHAR(1)` | Operating mode / enum string. *inferred* |
| `AccessTime` | `INTEGER` | Time stamp or duration (ticks unless noted). *inferred* |
| `MemoryType` | `INTEGER` | Memory-system related field. *inferred* |
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
