# `VfSimtIPCDynamicView.csv`

| | |
|--|--|
| **Contract object** | `VfSimtIPCDynamicView` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | view |
| Gelu rows | 0 |
| CSV file | `VfSimtIPCDynamicView.csv` |
| Role | Vector-function (VF) metrics or metadata. *inferred* |

| Column | Type | Description |
|--------|------|-------------|
| `CoreId` | `INTEGER` | Hardware / simulated core id. *inferred* |
| `CoreTypeId` | `INTEGER` | FK → CoreTypes. *inferred* |
| `WindowStartTick` | `INTEGER` | Simulation time in ticks. *inferred* |
| `ExecIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `LdStIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |
| `BranchIPC` | `REAL` | Instructions-per-cycle metric. *inferred* |

## Naming / type notes

- **Ticks vs µs.** Contract tables use integer **ticks**. Product `PipeTrace.json` must be packed in **µs** ([DATA-46](../../context/decisions/interim/DATA.md#data-46)).
- **Types** are SQLite/export declarations (`INTEGER`, `REAL`, `BOOLEAN`, `VARCHAR(n)`, `TEXT`, `FLOAT`). `(unspecified)` means the gelu export left `type` empty.
- **Hub join.** Most fact tables join on `ExecInstrId` → `ExecutedInstructions`.
- **Dictionaries.** `CoreTypes`, `InstrTypes`, `InstrQueueTypes`, `HintTypes`, and similar are name lookups; often present in DB but omitted from slim packs — see [TABLES.md](TABLES.md).
- **ELF / flag gated.** Call*, Source*, Functions, DebugInfo, BasicBlocks, many SIMT/VfSimt*, TraceBubble* stay at 0 rows unless analyzers / `--object-file` run.
