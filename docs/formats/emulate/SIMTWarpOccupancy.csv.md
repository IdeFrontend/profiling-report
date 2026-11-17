# `SIMTWarpOccupancy.csv`

| | |
|--|--|
| **Contract object** | `SIMTWarpOccupancy` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `SIMTWarpOccupancy.csv` |
| Role | SIMD/SIMT sampling or execution metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `WarpOccupancy` | `REAL` | SIMT warp related field. *inferred* |
