# `AnalysisState.csv`

| | |
|--|--|
| **Contract object** | `AnalysisState` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 31 |
| CSV file | `AnalysisState.csv` |
| Role | Which analyzers ran and whether each passed. |

| Column | Type | Description |
|--------|------|-------------|
| `AnalysisName` | `VARCHAR(70)` | Human-readable name / label. *inferred* |
| `AnalysisPassed` | `BOOLEAN` | Boolean flag. *inferred* |
