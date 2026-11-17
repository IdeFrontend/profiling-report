# `HintMessages.csv`

| | |
|--|--|
| **Contract object** | `HintMessages` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `HintMessages.csv` |
| Role | Performance-hint message text (packed CSV; gelu manifest row_count may be 0). |

| Column | Type | Description |
|--------|------|-------------|
| `HintMsgId` | `INTEGER` | Identifier for `HintMsg`. *inferred* |
| `HintMsgText` | `VARCHAR(500)` | Compiler / analyzer hint field. *inferred* |
