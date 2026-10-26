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
- Correlation keys use `` `${fileId}:${line}` ``.
- `mock: true` only on the deterministic fixture; real embeds set `mock: false`.

## Behavior

**Real path — compute multi-file.** When payloads include `objdump.txt` and at least one of `symbolizer.json` / `summary.db`, `adaptSourceCorrelation` builds a real model via `adaptComputeSourceCorrelation` (`mock: false`):

- Asm rows from `objdump.txt` (address + instruction text).
- Per-PC Sampling Stall (+ tooltip breakdown) from SQLite `summary.db` table `pc_sampling` via sql.js (`await ensurePcSamplingSql()` before adapt when stalls are needed). Missing / failed sql.js init, and corrupt / unsupported DBs, are ignored (warn + zero stalls); they do not abort report load. Instructions Executed and Warp Occupancy stay 0 unless that table also has `Instructions_Executed` and `Warp_Occupancy` (a 0–1 fraction). Sample packs include them; gather_2d does not ([DATA-55](../../docs/context/questions/DATA.md)). Mapped source lines sum stall and instructions and average occupancy.
- Optional PC→source sites from `symbolizer.json`; `Line <= 0` is treated as unmapped ([DATA-54](../../docs/context/questions/DATA.md)).
- Source text from a payload whose basename matches the symbolizer `FileName` (e.g. `gather_2d.asc`). Each distinct basename is its own file, in first-seen order; correlation keys use that file's id.

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

## Dependencies

[UI-37](../../docs/context/decisions/UI.md), [VIEW_DATA_REQUIREMENTS §15](../../docs/formats/VIEW_DATA_REQUIREMENTS.md), [view-models](./view-models.spec.md), [DATA-52](../../docs/context/questions/DATA.md)–[DATA-55](../../docs/context/questions/DATA.md).

## Changelog

- **2026-10-24** — Optional `pc_sampling` columns `Instructions_Executed` and `Warp_Occupancy` fill those Source / SASS metrics. Packs without the columns stay at 0.
- **2026-10-23** — PR-SRC-009: one source file per symbolizer basename.
- **2026-10-19** — Restore sql.js reader for `pc_sampling` (drop hand-rolled B-tree walker).
- **2026-10-16** — Hide 源码 unless a real Source pack adapts (`mock` is not shown).
- **2026-10-15** — Refresh gather_2d fixtures (symbolizer Line>0); `gather_2d.npu-rep` playground pack; PR-SRC-006/008; npu-compute PDF column list → DATA-55.
- **2026-10-15** — Compute multi-file adapt (`objdump` / `symbolizer` / `summary.db` / `.asc`); sql.js `pc_sampling` reader; PR-SRC-005–007.
- **2026-10-14** — Mock SASS density (≥40 rows), sketch-scale stalls, kernel-ABI assembly `path`.
- **2026-10-07** — Initial mock-first Source correlation adapter.
