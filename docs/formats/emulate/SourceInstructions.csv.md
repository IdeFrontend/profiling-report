# `SourceInstructions.csv`

| | |
|--|--|
| **Contract object** | `SourceInstructions` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `SourceInstructions.csv` |
| Role | Static disassembly listing for Source \| SASS (ELF gated; [DATA-53](../../context/decisions/DATA.md); [source](../../views/source.md)). |

| Column | Type | Description |
|--------|------|-------------|
| `SourceInstrSection` | `INTEGER` | ELF / binary section field. *inferred* |
| `SourceInstrAddr` | `INTEGER` | Memory or instruction address. *inferred* |
| `SourceInstrEncoding` | `VARCHAR(24)` | Instruction-related field. *inferred* |
| `SourceInstrText` | `VARCHAR(200)` | Instruction-related field. *inferred* |
| `DebugInfoId` | `INTEGER` | Identifier for `DebugInfo`. *inferred* |
| `SourceInstrQueueType` | `INTEGER` | Queue or pipe related field. *inferred* |
