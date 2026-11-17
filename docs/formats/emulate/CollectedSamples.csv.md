# `CollectedSamples.csv`

| | |
|--|--|
| **Contract object** | `CollectedSamples` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `CollectedSamples.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `Tick` | `INTEGER` | Simulation time in ticks. *inferred* |
| `Active` | `INTEGER` | Sampling counter bucket. *inferred* |
| `Stall` | `INTEGER` | Stall cycles or stall-related counter. *inferred* |
| `EmptyTicks` | `INTEGER` | Simulation time in ticks. *inferred* |
