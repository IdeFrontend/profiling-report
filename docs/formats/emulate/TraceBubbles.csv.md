# `TraceBubbles.csv`

| | |
|--|--|
| **Contract object** | `TraceBubbles` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `TraceBubbles.csv` |
| Role | Stall, queue-full, or bubble analysis. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `MainPipeline` | `TEXT` | Queue or pipe related field. *inferred* |
| `SubType` | `TEXT` | Classification / category label. *inferred* |
| `Category` | `TEXT` | Classification / category label. *inferred* |
| `TickStart` | `INTEGER` | Simulation time in ticks. *inferred* |
| `TickEnd` | `INTEGER` | Simulation time in ticks. *inferred* |
| `GapTicks` | `INTEGER` | Simulation time in ticks. *inferred* |
| `GapUs` | `REAL` | Trace bubble / idle-gap analysis field. *inferred* |
| `Reason` | `TEXT` | Stall or failure reason id/name. *inferred* |
| `Optimizable` | `INTEGER` | Purpose unclear; present in contract schema. *inferred* |
| `OptimizationHint` | `TEXT` | Compiler / analyzer hint field. *inferred* |
| `WaitedPipeline` | `TEXT` | Queue or pipe related field. *inferred* |
| `IterationIndex` | `INTEGER` | Purpose unclear; present in contract schema. *inferred* |
