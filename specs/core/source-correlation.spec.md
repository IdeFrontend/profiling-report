# Source Correlation

| spec-id-prefix |
|----------------|
| PR-SRC-*       |

Adapt report-pack payloads into `SourceCorrelationModel` for the 源码 tab (UI-37). `mockSourceCorrelation` remains a deterministic fixture for Source view tests; report adapters do not attach it.

```ts
adaptSourceCorrelation(payloads: Record<string, Uint8Array>): SourceCorrelationModel | null
mockSourceCorrelation(): SourceCorrelationModel
ensurePcSamplingSql(): Promise<void>
readPcSamplingDb(bytes: Uint8Array): Promise<PcSamplingRow[]>
```

## Unit contract

- Line numbers are **1-based**.
- Correlation maps: per-file `sourceToAsm: Map<sourceLine, asmLines[]>` and model `asmToSource: Map<asmLine, { fileId, line }>`.
- Current emulate packs carry the complete file text in `SourceLines.csv` as `SourceFileId,SourceLineNum,SourceLineId,SourceLine`; legacy packs have only `SourceLineId,SourceLine` and rely on `DebugInfo` for placement.
- Sparse emulate source files may set `lineCount` (max reported line) while `lines` stays sparse; dense listings omit `lineCount`.
- Sparse emulate source files set **sparse** so the view renders only reported lines; a complete `SourceLines` range or a host-resolved full file clears it.
- `mock: true` only on the deterministic fixture; real embeds set `mock: false`.

## Behavior

**Real path — compute multi-file.** When payloads include `objdump.txt` and at least one of `symbolizer.json` / `summary.db`, `adaptSourceCorrelation` builds a real model via `adaptComputeSourceCorrelation` (`mock: false`):

- Asm rows from `objdump.txt` (address + instruction text).
- Per-PC Sampling Stall (+ tooltip breakdown) from SQLite `summary.db` via sql.js (`await ensurePcSamplingSql()` before adapt when stalls are needed). Two producer schemas are accepted:
  - `PcSampling` — PC column `address` (integer, decimal) and counters `ibuf_empty`, `nop_cycles`, `scoreboard_not_ready`, `register_bank_conflict`, `resource_conflict`, `warp_level_sync`, `divergence_stack_spill`, `others` (gather_2d).
  - `pc_sampling` — PC column `pc_offset` (hex text such as `0x198`) and CamelCase counters (`IBuf_Empty`, …) (older fixtures).
  - Column names match exactly; case is significant, and the two schemas do not mix.
  - Absent individual counters count as 0 and add a warning; the report still loads.
  - Without a PC column, or without any counter, stall metrics are omitted and a warning is added; the report still loads.
  - Invalid addresses (negative, fractional, above 2^48) drop that row and add a warning.
  - Rows keep DB order; there is no sorting.
  - Missing / failed sql.js init, and corrupt / unsupported DBs, are ignored (warn + zero stalls); they do not abort report load.
  - Instructions Executed (count) and Warp Occupancy (0–1 fraction) stay 0 unless the table also has `Instructions_Executed` and `Warp_Occupancy`. Sample packs include them; gather_2d does not ([DATA-55](../../docs/context/questions/DATA.md)). Mapped source lines sum stall and instructions and average occupancy.
- Optional PC→source sites from `symbolizer.json`; `Line <= 0` is treated as unmapped ([DATA-54](../../docs/context/questions/DATA.md)).
- Source text from a payload whose basename matches the symbolizer `FileName` (e.g. `gather_2d.asc`). Each distinct basename is its own file, in first-seen order; that file's id is the basename used in `asmToSource` hits.
- When that pack text is absent, adapt still emits the file with a `// missing source embed: …` placeholder sized to the grown metrics line count and keeps mapped stall / instr / occupancy rollups so a host `resolveSourceFile` can fill the editor later without dropping them ([#175](https://github.com/IdeFrontend/profiling-report/issues/175)).

**Real path — emulate ELF CSVs.** When payloads include non-empty `SourceInstructions.csv` **or** `AsmMetrics.csv` with `PC` + instruction text, `adaptSourceCorrelation` builds a real model via `adaptEmulateSourceCorrelation` (`mock: false`, [DATA-53](../../docs/context/decisions/DATA.md)):

- Asm rows from `SourceInstructions` (prefer) or `AsmMetrics` fallback; Address = hex report PC; Assembly = `SourceInstrText` / `InstrName`.
- MVP metrics from `AsmMetrics` / `SourceLineMetrics`: ExecutionCount, TickCount, RelTime, WarpOccupancy, VectorUtilization (producer 0–100 stored as 0–1 for percent display). NULL → unavailable; numeric 0 stays 0.
- Text from `SourceLines` `(SourceFileId, SourceLineNum) → SourceLine` (current 4-column layout, indentation preserved). A contiguous `1..N` range is a complete file and renders as a normal full document with sparse metric rows (`sparse: false`); the source view shows every line and unreported metric cells stay blank.
- Instruction → line join: `SourceInstructions.DebugInfoId` → `DebugInfo`; when `DebugInfo.csv` is absent, fall back to `SourceLineMetrics.DebugInfoId`, then to `AsmMetrics` `(FileId, LineNum)` by `PC`. `LineNum > 0` only. Unmapped clears correlation.
- `SourceFiles` / `SourceLines` optional — assembly-only (`files: []`) or missing-embed placeholder (shared UX with compute).
- Legacy packs (`SourceLines` without file/line columns) render a **mapped document**: text is placed through `DebugInfo`, only reported lines carry a line number, and non-contiguous runs are separated by two blank unnumbered rows. Same fallback for a truncated line range (missing line numbers inside `1..N`). Metrics rows follow the collapsed order (no phantom zero rows), and caret / row selection translate between document rows and source lines. Gap rows do not paint metric bars. A caret on a gap row marks that same metrics row. A missing-embed banner stays on the first rendered row; a file with no reported lines renders that banner as the one shared row.
- Do **not** light from `IPCAsmMetrics` or hint CSVs alone ([DATA-53b](../../docs/context/decisions/interim/DATA.md#data-53b)).
- Deferred emulate slices: stalls ([DATA-53a](../../docs/context/decisions/interim/DATA.md#data-53a)), richer metrics / BB / stacks ([DATA-53c](../../docs/context/decisions/interim/DATA.md#data-53c)), full-file resolve ([DATA-53d](../../docs/context/decisions/interim/DATA.md#data-53d)), tick→ns ([DATA-53e](../../docs/context/decisions/interim/DATA.md#data-53e)), SASS label ([UI-53a](../../docs/context/decisions/interim/UI.md#ui-53a)).

**Real path — single JSON.** `SourceCorrelation.json` (and aliases) remain reserved; schema is still Product-TBD, so those embeds currently return `null` ([DATA-52](../../docs/context/questions/DATA.md)).

**No mock on the report.** When `adaptSourceCorrelation` returns null (or a `mock: true` model), `adaptPayloads` / `adaptEmulate` omit `sourceCorrelation` and do not advertise `'sourceTab'`. The 源码 control is absent.

**Chrome Trace–only.** `emptyReportViewModel` / `adaptChromeTrace` omit `sourceCorrelation` and do not advertise `'sourceTab'`.

**Mock shape.** At least one AscendC source file (`language: 'ascend-c'`; Sudu ≥ `0.0.130-alpha4`, ≥100 lines), one assembly buffer (≥40 SASS rows, kernel-ABI `path` like `sharpen[abi:…]`, sketch-scale Sampling Stall), non-empty `sourceToAsm` / `asmToSource`, and `navigateBy` metric ids matching column ids. Assembly `metricsColumns` order is Address · Assembly · Instructions Executed · Sampling Stall · Warp Occupancy (`text` for Address/Assembly).

## Acceptance Criteria

1. **PR-SRC-001** — `adaptSourceCorrelation` returns null on `out.rep` payloads.
2. **PR-SRC-002** — `mockSourceCorrelation` is deterministic with `mock: true` and bidirectional maps.
3. **PR-SRC-003** — `adaptRep(out.rep)` omits `sourceCorrelation` and `'sourceTab'` (no real embeds).
4. **PR-SRC-004** — `adaptChromeTrace` omits `sourceCorrelation` and `'sourceTab'`.
5. **PR-SRC-005** — gather_2d compute embeds (`objdump` + `symbolizer` + `summary.db` + `.asc`) yield `mock: false` with AscendC source text and asm stall metrics from `pc_sampling`.
6. **PR-SRC-006** — symbolizer `Line > 0` fills `sourceToAsm` / `asmToSource` (basename match on `FileName`); `Line: 0` stays unmapped (DATA-54 interim).
7. **PR-SRC-007** — `parseObjdump` extracts instruction rows from the gather_2d listing.
8. **PR-SRC-008** — `loadReportSource(gather_2d.npu-rep)` (leaf with `.asc` embed) yields `sourceCorrelation.mock === false` and non-empty maps.
9. **PR-SRC-009** — Distinct symbolizer basenames become separate source files; `Line <= 0` stays unmapped.
10. **PR-SRC-010** — Missing `.asc` embed keeps padded placeholder and mapped-line stall metrics.
11. **PR-SRC-011** — Partial counters and invalid addresses degrade.
12. **PR-SRC-012** — Emulate ELF CSVs yield `mock: false` with PC↔line maps and MVP metrics (NULL vs 0).
13. **PR-SRC-013** — AsmMetrics-only (no SourceFiles) lights assembly-only model.
14. **PR-SRC-014** — Missing SourceLines keeps missing-embed placeholder and mapped line metrics.
15. **PR-SRC-015** — IPCAsmMetrics / hints alone do not light the gate.
16. **PR-SRC-016** — `adaptSourceCorrelation` dispatches emulate ELF packs.
17. **PR-SRC-017** — `adaptEmulate` with ELF attaches `sourceCorrelation` + `'sourceTab'`.
18. **PR-SRC-018** — Sparse emulate lines render as mapped document.
19. **PR-SRC-019** — Located SourceLines build the full file text.

## Dependencies

[UI-37](../../docs/context/decisions/UI.md), [compute FORMAT](../../docs/formats/compute/FORMAT.md), [emulate FORMAT](../../docs/formats/emulate/FORMAT.md), [source view](../../docs/views/source.md), [view-models](./view-models.spec.md), [DATA-52](../../docs/context/questions/DATA.md), [DATA-53](../../docs/context/decisions/DATA.md), [DATA-54](../../docs/context/questions/DATA.md), [DATA-55](../../docs/context/questions/DATA.md).

## Changelog

- **2026-11-26** — Emulate adapter uses the current `SourceLines` layout (`SourceFileId,SourceLineNum,SourceLineId,SourceLine`) as complete file text, with `AsmMetrics` / `SourceLineMetrics` mapping fallbacks (`PR-SRC-019`). Legacy 2-column packs keep the collapsed view.
- **2026-11-25** — Sparse gap rows hide metric bars, the caret row stays aligned with the metrics highlight, and a missing-embed banner stays on the first rendered row (`PR-SRC-018`).
- **2026-11-25** — Sparse emulate source renders a mapped document (`newTextModelFromLines`) with blank gap rows; metrics table follows the collapsed order (`PR-SRC-018`).
- **2026-11-17** — Emulate ELF Source path (`adaptEmulateSourceCorrelation`, DATA-53): PR-SRC-012…017.
- **2026-11-11** — Sampling Stall accepts both producer schemas (`PcSampling`/`address`, `pc_sampling`/`pc_offset`); partial counters, invalid addresses, and missing columns degrade with warnings (`PR-SRC-011`, [#212](https://github.com/IdeFrontend/profiling-report/pull/212)).
- **2026-10-28** — Missing `.asc` embed keeps metrics-aligned placeholder and stall rollups (`PR-SRC-010`, [#175](https://github.com/IdeFrontend/profiling-report/issues/175)).
- **2026-10-24** — Optional `pc_sampling` columns `Instructions_Executed` and `Warp_Occupancy` fill those Source / SASS metrics. Packs without the columns stay at 0.
- **2026-10-23** — PR-SRC-009: one source file per symbolizer basename.
- **2026-10-19** — Restore sql.js reader for `pc_sampling` (drop hand-rolled B-tree walker).
- **2026-10-16** — Hide 源码 unless a real Source pack adapts (`mock` is not shown).
- **2026-10-15** — Refresh gather_2d fixtures (symbolizer Line>0); `gather_2d.npu-rep` playground pack; PR-SRC-006/008; npu-compute PDF column list → DATA-55.
- **2026-10-15** — Compute multi-file adapt (`objdump` / `symbolizer` / `summary.db` / `.asc`); sql.js `pc_sampling` reader; PR-SRC-005–007.
- **2026-10-14** — Mock SASS density (≥40 rows), sketch-scale stalls, kernel-ABI assembly `path`.
- **2026-10-07** — Initial mock-first Source correlation adapter.
