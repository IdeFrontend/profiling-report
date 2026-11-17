# `ArchDiagramMetrics.csv`

| | |
|--|--|
| **Contract object** | `ArchDiagramMetrics` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 240 |
| CSV file | `ArchDiagramMetrics.csv` |
| Role | Architecture-diagram / bandwidth-style scalar parameters (MHTML §11.2.3.1). |

| Column | Type | Description |
|--------|------|-------------|
| `ArchDiagramId` | `INTEGER` | Identifier for `ArchDiagram`. *inferred* |
| `ArchDiagramParameterName` | `VARCHAR(20)` | Human-readable name / label. *inferred* |
| `ArchDiagramParameterValue` | `REAL` | Instruction or DMA / matmul parameter. *inferred* |
