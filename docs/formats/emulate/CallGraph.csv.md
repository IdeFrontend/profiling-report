# `CallGraph.csv`

| | |
|--|--|
| **Contract object** | `CallGraph` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `CallGraph.csv` |
| Role | Call-graph edges (ELF / object-file gated). |

| Column | Type | Description |
|--------|------|-------------|
| `CallFunctionId` | `INTEGER` | Identifier for `CallFunction`. *inferred* |
| `ChildFunctionId` | `INTEGER` | Identifier for `ChildFunction`. *inferred* |
| `CallSiteLine` | `INTEGER` | Source line number or id. *inferred* |
