# `DmaMovProcessedBytes.csv`

| | |
|--|--|
| **Contract object** | `DmaMovProcessedBytes` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 32 |
| CSV file | `DmaMovProcessedBytes.csv` |
| Role | DMA-move parameters or traffic. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `ProcessedBytes` | `INTEGER` | Size in bytes (or related unit). *inferred* |
| `MemoryTraffic` | `REAL` | Memory-system related field. *inferred* |
| `CacheHit` | `BOOLEAN` | Cache hit/miss related field. *inferred* |
