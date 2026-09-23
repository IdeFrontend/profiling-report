# Performance hints

| | |
|--|--|
| **Id** | `performance-hints` |
| **Panel / component** | Planned bottom dock (性能提示 / 性能分析) — not built |
| **Capability** | _(none yet)_ |
| **Phase** | M4 |
| **Unification** | `adapt-mapper` |
| **Sept 30 (emulate)** | **planned** |

## Sketches

![Performance hints report panel](../ui/source/v930-sim/performance-hints.jpeg)

Sketch shows a **性能分析** table under the timeline: **Hint Message**, **Source Line**, **Instruction Address**. Annotations call for a **性能分析** tab (增加页签) and a trigger in the report panel (触发按钮).

## Purpose

List simulator performance hints for the open emulate kernel: advice text, the source line it attaches to, and the instruction address when the hint is per-PC.

## View-model

| Field | Role | Required? |
|-------|------|-----------|
| `hintRows[]` (planned) | Rows for the 性能分析 table | **Required to show** |
| `hintRows[].message` | Hint Message column | Required per row |
| `hintRows[].sourceLine` | Source Line column | Optional |
| `hintRows[].instructionAddress` | Instruction Address column | Optional |
| `hintRows[].kind` | `instruction` \| `sourceLine` \| `kernel` | Optional (for grouping) |

## Hide rule

No joined hint rows → **hide** the panel ([DATA-30](../context/decisions/DATA.md)). Do not invent hints from compute CSVs ([DATA-45](../context/decisions/interim/DATA.md#data-45)).

## Compute fill

| VM field | Source embed(s) | Join key(s) | Derivation |
|----------|-----------------|-------------|------------|
| — | — | — | No compute equivalent |

## Emulate fill

Schemas: [SCHEMA](../formats/emulate/SCHEMA.md) (`HintMessages`, `HintTypes`, `InstructionHints`, `KernelHints`, `SourceLineHints`, `SourceLines`). Pack status: [TABLES](../formats/emulate/TABLES.md). **Mapper not wired yet** — joins below are the planned contract for `adaptEmulate`.

### Embeds involved

| Embed | Role |
|-------|------|
| `HintMessages.csv` | Message dictionary (`HintMsgId` → `HintMsgText`) |
| `HintTypes.csv` | Type dictionary (`HintTypeId` → `HintTypeName`, `HintPassed`) |
| `InstructionHints.csv` | Fact: hint per PC |
| `SourceLineHints.csv` | Fact: hint per source-line id |
| `KernelHints.csv` | Fact: kernel-level hint (no PC, no line) |
| `SourceLines.csv` | Line display text (`SourceLineId` → `SourceLine`) — often empty without `--object-file` |

Optional pre-joined producer views (`InstructionHintsView`, `SourceLineHintsView`, `KernelHintsView`) may already carry `HintMsgText`; prefer raw tables + joins unless a packed view is present and complete.

### Join graph

```text
InstructionHints ──HintMsgId──► HintMessages.HintMsgText
       │
       ├──HintTypeId──► HintTypes.HintTypeName
       └──PC (display as instruction address; no further join)

SourceLineHints ──HintMsgId──► HintMessages.HintMsgText
       │
       ├──HintTypeId──► HintTypes.HintTypeName
       └──SourceLineId──► SourceLines.SourceLine   ← gap when SourceLines empty

KernelHints ──HintMsgId──► HintMessages.HintMsgText
       └──HintTypeId──► HintTypes.HintTypeName
```

### Join keys (normative)

| From embed | Key column | To embed | To column | Result column |
|------------|------------|----------|-----------|---------------|
| `InstructionHints` / `SourceLineHints` / `KernelHints` | `HintMsgId` | `HintMessages` | `HintMsgId` | `HintMsgText` |
| same fact tables | `HintTypeId` | `HintTypes` | `HintTypeId` | `HintTypeName` (optional UI) |
| `SourceLineHints` | `SourceLineId` | `SourceLines` | `SourceLineId` | `SourceLine` |
| `InstructionHints` | `PC` | _(none)_ | — | display as instruction address |

Equality join on integer ids. Drop a fact row if `HintMsgId` does not resolve (no message text). Missing `HintTypeId` is OK (message still shows). Missing `SourceLines` row → leave `sourceLine` empty (do not invent).

### VM field ← source (derivation)

| VM field | Source embed(s) | Join key(s) | Derivation |
|----------|-----------------|-------------|------------|
| `hintRows[].message` | fact + `HintMessages` | `HintMsgId` | `HintMsgText`; optionally prefix/suffix with `HintTypeName` when `HintTypeId` resolves |
| `hintRows[].instructionAddress` | `InstructionHints` | — | `PC` (format TBD in UI; raw integer until product specifies hex) |
| `hintRows[].sourceLine` | `SourceLineHints` + `SourceLines` | `SourceLineId` | `SourceLines.SourceLine`; **gap** when `SourceLines` is empty / unpacked |
| `hintRows[].kind` | which fact table produced the row | — | `instruction` from `InstructionHints`; `sourceLine` from `SourceLineHints`; `kernel` from `KernelHints` |
| kernel-only row | `KernelHints` + `HintMessages` | `HintMsgId` | Message only; `sourceLine` and `instructionAddress` omitted |

Union all three fact kinds into one `hintRows[]` (stable order: instruction → sourceLine → kernel, or product-defined). Deduping by `(kind, HintId)` if the same hint appears twice.

`HintMessages`, `InstructionHints`, `KernelHints`, and `SourceLineHints` may be packed even when the export catalog records `row_count` 0.

## Adapter

| Profile | Entry | Notes |
|---------|-------|-------|
| compute | — | Out of scope |
| emulate | `adaptEmulate` (planned) | Not wired — no hint CSVs read today |

## Related

- Plan: [milestone-4](../process/roadmap/milestone-4.md)
- Schema: [SCHEMA](../formats/emulate/SCHEMA.md) hint tables
- Sketch index: [DESIGN_INDEX](../ui/DESIGN_INDEX.md)
- Catalog: [README](README.md)
