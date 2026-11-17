# `VfSimtInvocations.csv`

| | |
|--|--|
| **Contract object** | `VfSimtInvocations` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `VfSimtInvocations.csv` |
| Role | Vector-function (VF) metrics or metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `VfSimtAddr` | `INTEGER` | Memory or instruction address. *inferred* |
| `KernelAddr` | `INTEGER` | Memory or instruction address. *inferred* |
| `ThreadDimX` | `INTEGER` | Thread / launch dimension field. *inferred* |
| `ThreadDimY` | `INTEGER` | Thread / launch dimension field. *inferred* |
| `ThreadDimZ` | `INTEGER` | Thread / launch dimension field. *inferred* |
| `RegisterNum` | `INTEGER` | Register / SPR / predicate field. *inferred* |
| `CodeSizeBytes` | `INTEGER` | Size in bytes (or related unit). *inferred* |
