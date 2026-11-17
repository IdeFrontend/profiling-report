# `UbRwStatistics.csv`

| | |
|--|--|
| **Contract object** | `UbRwStatistics` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `UbRwStatistics.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `ExecInstrId` | `INTEGER` | FK → ExecutedInstructions. *inferred* |
| `ProcessedBytes` | `INTEGER` | Size in bytes (or related unit). *inferred* |
| `UbAccessType` | `INTEGER` | Memory-system related field. *inferred* |
| `SimtDataCache` | `BOOLEAN` | Cache-related field. *inferred* |
