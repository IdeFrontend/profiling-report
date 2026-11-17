# Source / assembly (源码)

| | |
|--|--|
| **Id** | `source` |
| **Panel / component** | `SourceView` → `src/ui/SourceView/` ([SourceView.spec.md](../../src/ui/SourceView/SourceView.spec.md)) |
| **Capability** | `sourceTab` |
| **Phase** | M (compute); P2 (emulate ELF) |
| **Unification** | `adapt-mapper` |
| **Sept 30 (emulate)** | **hide** on gelu-without-ELF; **in** when ELF Source* / AsmMetrics pack lights the gate ([DATA-53](../context/decisions/DATA.md)) |

## Sketches

![Source correlation dual pane](../ui/source/v930-source/source-correlation.jpeg)

Component crop: [`src/ui/SourceView/visual/source-correlation.png`](../../src/ui/SourceView/visual/source-correlation.png).

## Purpose

Dual-pane **Source | SASS** correlation: source text with per-line metrics beside a shared disassembly listing with per-instruction metrics, linked by PC↔file/line maps. Compute fills from objdump/symbolizer/summary.db; emulate fills from ELF-gated aggregate CSVs.

## View-model

| Field | Role | Required? |
|-------|------|-----------|
| `reportModel.sourceCorrelation` | Dual-pane model | **Required to show** (`mock: false`) |
| `files[]` | Source buffers (`id`, `path`, `text`, per-line metrics) | Optional — may be empty (assembly-only) or placeholder text |
| `assembly` | SASS listing + metrics | **Required** |
| `sourceToAsm` / `asmToSource` | Bidirectional maps | May be empty when unmapped |
| `navigateBy` | Metric ids for Navigate By | From columns |
| `mock` | Must be `false` on real packs | — |

## Hide rule

No real Source pack adapted → omit `sourceCorrelation` and `'sourceTab'` ([DATA-30](../context/decisions/DATA.md), [UI-37](../context/decisions/UI.md)). Do not show mock data on report packs. Do not invent Source panes from tracing JSON when aggregate views exist ([DATA-45](../context/decisions/interim/DATA.md#data-45), [DATA-53](../context/decisions/DATA.md)).

## Compute fill

**On-disk SSOT:** [compute/FORMAT.md](../formats/compute/FORMAT.md) — [`objdump.txt.md`](../formats/compute/objdump.txt.md), [`symbolizer.json.md`](../formats/compute/symbolizer.json.md), [`summary.db.md`](../formats/compute/summary.db.md).

| VM field | Source embed(s) | Join key(s) | Derivation |
|----------|-----------------|-------------|------------|
| `assembly.lines` | [`objdump.txt`](../formats/compute/objdump.txt.md) | PC address | Parse insn rows; address + text columns |
| `assembly` / source stall metrics | [`summary.db`](../formats/compute/summary.db.md) ([`pc_sampling`](../formats/compute/summary.db.md#pc_sampling) or [`PcSampling`](../formats/compute/summary.db.md#PcSampling)) | PC ↔ [`objdump.txt`](../formats/compute/objdump.txt.md) PC | Sampling Stall = sum of stall counters; optional instr / occupancy columns |
| `files[].path` / `id` | [`symbolizer.json`](../formats/compute/symbolizer.json.md) | `Symbol.FileName` basename | One file per distinct basename; `id` = basename |
| `sourceToAsm` / `asmToSource` | [`symbolizer.json`](../formats/compute/symbolizer.json.md) + [`objdump.txt`](../formats/compute/objdump.txt.md) | PC + `Line > 0` | Unmapped when `Line <= 0` ([DATA-54](../context/questions/DATA.md)) |
| `files[].text` | [`.asc` / `.cpp` / `.h`](../formats/compute/symbolizer.json.md#source-text) pack embed | basename match to `FileName` | Else missing-embed placeholder; host may `resolveSourceFile` |

**Switch:** `adaptSourceCorrelation` → `adaptComputeSourceCorrelation` when `hasComputeSourcePack`. Called from `adaptPayloads` and `adaptEmulate`.

**Host:** optional `resolveSourceFile({ fileName, basename })` on `<ProfilingReport>` fills missing Ascend C after load ([MSTT_INTEGRATION](../architecture/MSTT_INTEGRATION.md) § `resolveSourceFile`). Library does not read the filesystem.

**Assembly-only / missing source text:** missing `.asc` still lights the tab with placeholder text and keeps mapped metrics ([DATA-53](../context/decisions/DATA.md) shared UX with emulate).

## Emulate fill

**On-disk SSOT:** [emulate/FORMAT.md](../formats/emulate/FORMAT.md) — [`SourceInstructions.csv`](../formats/emulate/SourceInstructions.csv.md), [`DebugInfo.csv`](../formats/emulate/DebugInfo.csv.md), [`SourceFiles.csv`](../formats/emulate/SourceFiles.csv.md), [`SourceLines.csv`](../formats/emulate/SourceLines.csv.md), [`AsmMetrics.csv`](../formats/emulate/AsmMetrics.csv.md), [`SourceLineMetrics.csv`](../formats/emulate/SourceLineMetrics.csv.md). Producer contract: npu-simulator `source_assembly_data_format.md`.

**Gate:** non-empty [`SourceInstructions.csv`](../formats/emulate/SourceInstructions.csv.md) **or** non-empty [`AsmMetrics.csv`](../formats/emulate/AsmMetrics.csv.md) with `PC` + instruction text. `SourceFiles` / `SourceLines` optional. Do **not** light from [`IPCAsmMetrics.csv`](../formats/emulate/IPCAsmMetrics.csv.md) or hint CSVs alone. Gelu-without-ELF → omit tab.

### Join graph

```text
SourceInstructions ──DebugInfoId──► DebugInfo
       │                               ├──SourceFileId──► SourceFiles
       │                               └──SourceLineId──► SourceLines
       └──PC──► AsmMetrics

SourceLineMetrics ──(FileId, LineNum)──► source file metric rows
```

### VM field ← source

| VM field | Source embed(s) | Join key(s) | Derivation |
|----------|-----------------|-------------|------------|
| `assembly` rows | [`SourceInstructions.csv`](../formats/emulate/SourceInstructions.csv.md) (+ [`AsmMetrics.csv`](../formats/emulate/AsmMetrics.csv.md) by `PC`) | `SourceInstrAddr` = `PC` | Order by `(SourceInstrSection, SourceInstrAddr)`; Address = hex report PC; Assembly = `SourceInstrText` (prefer) / `InstrName`. Fallback listing from AsmMetrics alone when SourceInstructions absent |
| `assembly.lines` metrics | [`AsmMetrics.csv`](../formats/emulate/AsmMetrics.csv.md) | `PC` | MVP: ExecutionCount, TickCount, RelTime, WarpOccupancy, VectorUtilization. NULL → unavailable; 0 stays 0. Unexecuted static insn may show `ExecutionCount = 0` |
| `files[]` | [`SourceFiles.csv`](../formats/emulate/SourceFiles.csv.md) | `SourceFileId` | One file per id; `id` = string id; `path` = `SourceFilePath`. Absent → `files: []` (assembly-only) |
| `files[].text` | [`DebugInfo.csv`](../formats/emulate/DebugInfo.csv.md) + [`SourceLines.csv`](../formats/emulate/SourceLines.csv.md) | `DebugInfoId` / `SourceLineId` | Sparse reconstruct at `DebugInfoLineNum`; gaps empty. Null `SourceLineId` or missing text → missing-embed placeholder (same prefix as compute). Not a full editor document; no host auto-read of absolute producer paths |
| `files[].lines` metrics | [`SourceLineMetrics.csv`](../formats/emulate/SourceLineMetrics.csv.md) | `(FileId, LineNum)` | Same MVP column ids as asm |
| `sourceToAsm` / `asmToSource` | SourceInstructions ⟕ DebugInfo ⟕ SourceFiles | `LineNum > 0` + file present | 1:N source→asm; first valid map wins for asm→source. Unmapped clears selection (never invent line 1) |
| `navigateBy` | — | — | `executionCount`, `tickCount`, `relTime`, `warpOccupancy`, `vectorUtilization` |
| `mock` | — | — | Always `false` when gate passes |

**Address space:** launch-relative report PCs only (do not convert via `object_entry_pc` for UI joins).

**Deferred (interim):** [`DATA-53a`](../context/decisions/interim/DATA.md#data-53a) stalls tooltip; [`DATA-53b`](../context/decisions/interim/DATA.md#data-53b) `IPCAsmMetrics`; [`DATA-53c`](../context/decisions/interim/DATA.md#data-53c) richer metrics / function-BB / call stacks / charts; [`DATA-53d`](../context/decisions/interim/DATA.md#data-53d) full-file host resolver; [`DATA-53e`](../context/decisions/interim/DATA.md#data-53e) tick→ns; [`UI-53a`](../context/decisions/interim/UI.md#ui-53a) SASS chrome label.

**Switch:** `adaptSourceCorrelation` → `adaptEmulateSourceCorrelation` when `hasEmulateSourcePack` (after compute-pack check).

## Adapter

| Profile | Entry | Notes |
|---------|-------|-------|
| compute | `adaptPayloads` → `adaptSourceCorrelation` | Wired — `adaptComputeSourceCorrelation` |
| emulate | `adaptEmulate` → `adaptSourceCorrelation` | Wired — `adaptEmulateSourceCorrelation` when ELF gate passes ([DATA-53](../context/decisions/DATA.md)) |

## Fixtures

| Pack | Notes |
|------|--------|
| `data/gather_2d/out.npu-rep` | Producer-style compute: objdump + symbolizer + summary.db; **no** `.asc` |
| `data/gather_2d.npu-rep` | Same + embedded `gather_2d.asc` |
| `data/sample.lite.rep` | Multi-file `.cpp`/`.h` + shared objdump / symbolizer / summary.db |
| `data/out.rep` | No Source embeds → no tab |
| `data/gelu.npu-rep` | Emulate without ELF Source* → **no** tab (negative) |
| Synthetic unit CSVs | Emulate happy path / assembly-only / NULL metrics (unit tests) |

## Open

DATA-52 (pack `.asc` rule / single JSON), DATA-54 (`Line: 0`), DATA-55 (extra compute metric columns), UI-56–59 (chrome modes / dock / heat tint). Emulate Source follow-ons ride interim [DATA-53a](../context/decisions/interim/DATA.md#data-53a)–[DATA-53e](../context/decisions/interim/DATA.md#data-53e) / [UI-53a](../context/decisions/interim/UI.md#ui-53a).

## Specs / code

- [source-correlation.spec.md](../../specs/core/source-correlation.spec.md) (`PR-SRC-*`)
- [adapt-emulate.spec.md](../../specs/core/adapt-emulate.spec.md) (`PR-ASIM-*`)
- [SourceView.spec.md](../../src/ui/SourceView/SourceView.spec.md) (`PR-SOURCE-*`)
- Adapters under `src/adapters/sourceCorrelation/`
