# `Regions.csv`

| | |
|--|--|
| **Contract object** | `Regions` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `Regions.csv` |
| Role | Contract DB object from npu_emulate export. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `RegionNameId` | `INTEGER` | Identifier for `RegionName`. *inferred* |
| `RegionStart` | `INTEGER` | Register / SPR / predicate field. *inferred* |
| `RegionEnd` | `INTEGER` | Register / SPR / predicate field. *inferred* |
| `RegionCoreId` | `INTEGER` | Identifier for `RegionCore`. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `RegionTypeId` | `INTEGER` | Identifier for `RegionType`. *inferred* |
| `InstrQueueTypeId` | `INTEGER` | Identifier for `InstrQueueType`. *inferred* |
| `WarpId` | `INTEGER` | Identifier for `Warp`. *inferred* |
