# `CallStacks.csv`

| | |
|--|--|
| **Contract object** | `CallStacks` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `CallStacks.csv` |
| Role | Call-stack frames (ELF gated). |

| Column | Type | Description |
|--------|------|-------------|
| `CallFunctionId` | `INTEGER` | Identifier for `CallFunction`. *inferred* |
| `StackId` | `INTEGER` | Identifier for `Stack`. *inferred* |
| `StackLevel` | `INTEGER` | Call-graph / stack / function field (often ELF-gated). *inferred* |
| `CallSiteLine` | `INTEGER` | Source line number or id. *inferred* |
