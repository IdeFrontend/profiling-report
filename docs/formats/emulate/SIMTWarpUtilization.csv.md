# `SIMTWarpUtilization.csv`

| | |
|--|--|
| **Contract object** | `SIMTWarpUtilization` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `SIMTWarpUtilization.csv` |
| Role | SIMD/SIMT sampling or execution metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `SIMTBlockId` | `INTEGER` | Identifier for `SIMTBlock`. *inferred* |
| `WarpId` | `INTEGER` | Identifier for `Warp`. *inferred* |
| `TickStart` | `INTEGER` | Simulation time in ticks. *inferred* |
| `Duration` | `INTEGER` | Duration (ticks or µs per producer). *inferred* |
| `WarpUtilization` | `REAL` | Utilization ratio or percent. *inferred* |
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
