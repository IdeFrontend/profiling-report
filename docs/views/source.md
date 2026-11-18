# Source / assembly (源码)

| | |
|--|--|
| **Id** | `source` |
| **Panel / component** | `SourceView` → `src/ui/SourceView/` ([SourceView.spec.md](../../src/ui/SourceView/SourceView.spec.md)) |
| **Capability** | `sourceTab` |
| **Phase** | M |
| **Unification** | `adapt-mapper` (compute); emulate **gap** ([DATA-53](../context/questions/DATA.md)) |
| **Sept 30 (emulate)** | **hide** until ELF / Source* tables map |

## Sketches

![Source correlation dual pane](../ui/source/v930-source/source-correlation.jpeg)

Component crop: [`src/ui/SourceView/visual/source-correlation.png`](../../src/ui/SourceView/visual/source-correlation.png).

## Purpose

Dual-pane **Source | SASS** correlation: Ascend C (or C++) text with per-line metrics beside disassembly with per-instruction stalls, linked by PC→line maps from the compute Source pack.

## View-model

| Field | Role | Required? |
|-------|------|-----------|
| `reportModel.sourceCorrelation` | Dual-pane model | **Required to show** (`mock: false`) |
| `files[]` | Source buffers (`id`, `path`, `text`, per-line metrics) | At least one file id (may be placeholder text) |
| `assembly` | SASS listing + metrics | **Required** |
| `sourceToAsm` / `asmToSource` | Bidirectional maps | May be empty if all `Line <= 0` |
| `navigateBy` | Metric ids for Navigate By | From columns |
| `mock` | Must be `false` on real packs | — |

**Freshness ([DATA-57](../context/decisions/DATA.md#data-57)):** compare interleaved source text in [`objdump.txt`](../formats/compute/objdump.txt.md) to matched local file content (host lookup / `resolveSourceFile` — Kirill Aleshin; do not duplicate). On mismatch → **warning** only; does **not** hide the tab. Normative: [SOURCE_PROVENANCE](../formats/SOURCE_PROVENANCE.md).

## Hide rule

No real Source pack adapted → omit `sourceCorrelation` and `'sourceTab'` ([DATA-30](../context/decisions/DATA.md), [UI-37](../context/decisions/UI.md)). Do not show mock data on report packs. Do not invent Source panes from emulate tables without Product map ([DATA-45](../context/decisions/interim/DATA.md#data-45), [DATA-53](../context/questions/DATA.md)).

## Compute fill

**On-disk SSOT:** [compute/FORMAT.md](../formats/compute/FORMAT.md) — [`objdump.txt.md`](../formats/compute/objdump.txt.md), [`symbolizer.json.md`](../formats/compute/symbolizer.json.md), [`summary.db.md`](../formats/compute/summary.db.md).

| VM field | Source embed(s) | Join key(s) | Derivation |
|----------|-----------------|-------------|------------|
| `assembly.lines` | [`objdump.txt`](../formats/compute/objdump.txt.md) | PC address | Parse insn rows; address + text columns |
| `assembly` / source stall metrics | [`summary.db`](../formats/compute/summary.db.md) ([`pc_sampling`](../formats/compute/summary.db.md#pc_sampling) or [`PcSampling`](../formats/compute/summary.db.md#PcSampling)) | PC ↔ [`objdump.txt`](../formats/compute/objdump.txt.md) PC | Sampling Stall = sum of stall counters; optional instr / occupancy columns |
| `files[].path` / `id` | [`symbolizer.json`](../formats/compute/symbolizer.json.md) | `Symbol.FileName` basename | One file per distinct basename; `id` = basename |
| `sourceToAsm` / `asmToSource` | [`symbolizer.json`](../formats/compute/symbolizer.json.md) + [`objdump.txt`](../formats/compute/objdump.txt.md) | PC + `Line > 0` | Unmapped when `Line <= 0` ([DATA-54](../context/questions/DATA.md)) |
| `files[].text` | [`.asc` / `.cpp` / `.h`](../formats/compute/symbolizer.json.md#source-text) pack embed | basename match to `FileName` | Else missing-embed placeholder; host may `resolveSourceFile` |

**Switch:** `adaptSourceCorrelation` → `adaptComputeSourceCorrelation` when `hasComputeSourcePack`. Called from `adaptPayloads` (and from `adaptEmulate` if those embeds ever appear on an emulate leaf).

**Host:** optional `resolveSourceFile({ fileName, basename })` on `<ProfilingReport>` fills missing Ascend C after load ([MSTT_INTEGRATION](../architecture/MSTT_INTEGRATION.md) § `resolveSourceFile`). Library does not read the filesystem.

## Emulate fill

| Adapted field | Embed | Status |
|---------------|-------|--------|
| Source \| SASS | [`SourceFiles.csv`](../formats/emulate/SourceFiles.csv.md) / [`SourceLines.csv`](../formats/emulate/SourceLines.csv.md) / [`AsmMetrics.csv`](../formats/emulate/AsmMetrics.csv.md) / ELF | **gap** — [DATA-53](../context/questions/DATA.md); gelu without `--object-file` has empty Source* tables |

## Fixtures

| Pack | Notes |
|------|--------|
| `data/gather_2d/out.npu-rep` | Producer-style: [`objdump.txt`](../formats/compute/objdump.txt.md) + [`symbolizer.json`](../formats/compute/symbolizer.json.md) + [`summary.db`](../formats/compute/summary.db.md); **no** [`.asc`](../formats/compute/symbolizer.json.md#source-text) |
| `data/gather_2d.npu-rep` | Same + embedded [`gather_2d.asc`](../formats/compute/symbolizer.json.md#source-text) |
| `data/sample.lite.rep` | Multi-file [`.cpp`/`.h`](../formats/compute/symbolizer.json.md#source-text) + shared [`objdump.txt`](../formats/compute/objdump.txt.md) / [`symbolizer.json`](../formats/compute/symbolizer.json.md) / [`summary.db`](../formats/compute/summary.db.md) |
| `data/out.rep` | No Source embeds → no tab |

## Open

DATA-52 (pack [`.asc`](../formats/compute/symbolizer.json.md#source-text) rule / single JSON), DATA-53 (emulate), DATA-54 (`Line: 0`), DATA-55 (extra metric columns). Runtime freshness compare + warning UI (rule already in [DATA-57](../context/decisions/DATA.md#data-57) / [SOURCE_PROVENANCE](../formats/SOURCE_PROVENANCE.md)).

## Specs / code

- [source-correlation.spec.md](../../specs/core/source-correlation.spec.md) (`PR-SRC-*`)
- [SourceView.spec.md](../../src/ui/SourceView/SourceView.spec.md) (`PR-SOURCE-*`)
- Adapters under `src/adapters/sourceCorrelation/`
