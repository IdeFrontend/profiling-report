# Source Correlation

| spec-id-prefix |
|----------------|
| PR-SRC-*       |

Adapt report-pack payloads into `SourceCorrelationModel` for the 源码 tab (UI-37), with a deterministic mock when real embeds are absent.

```ts
adaptSourceCorrelation(payloads: Record<string, Uint8Array>): SourceCorrelationModel | null
mockSourceCorrelation(): SourceCorrelationModel
ensurePcSamplingSql(): Promise<void>
```

## Unit contract

- Line numbers are **1-based**.
- Correlation keys use `` `${fileId}:${line}` ``.
- `mock: true` only on the deterministic fixture; real embeds set `mock: false`.

## Behavior

**Real path — compute multi-file.** When payloads include `objdump.txt` and at least one of `symbolizer.json` / `summary.db`, `adaptSourceCorrelation` builds a real model via `adaptComputeSourceCorrelation` (`mock: false`):

- Asm rows from `objdump.txt` (address + instruction text).
- Per-PC Sampling Stall (+ tooltip breakdown) from SQLite `summary.db` table `pc_sampling` (requires `await ensurePcSamplingSql()` before adapt when the db is present).
- Optional PC→source sites from `symbolizer.json`; `Line <= 0` is treated as unmapped ([DATA-54](../../docs/context/questions/DATA.md)).
- Source text from a payload whose basename matches the symbolizer `FileName` (e.g. `gather_2d.asc`).

**Real path — single JSON.** `SourceCorrelation.json` (and aliases) remain reserved; schema is still Product-TBD, so those embeds currently return `null` ([DATA-52](../../docs/context/questions/DATA.md)).

**Mock fallback.** Report-pack adapters (`adaptPayloads`, `adaptEmulate`) assign `reportModel.sourceCorrelation = adapt(...) ?? mockSourceCorrelation()` and push capability `'sourceTab'`.

**Chrome Trace–only.** `emptyReportViewModel` / `adaptChromeTrace` omit `sourceCorrelation` and do not advertise `'sourceTab'`.

**Mock shape.** At least one AscendC source file (`language: 'ascend-c'`; Sudu ≥ `0.0.130-alpha4`, ≥100 lines), one assembly buffer (≥40 SASS rows, kernel-ABI `path` like `sharpen[abi:…]`, sketch-scale Sampling Stall), non-empty `sourceToAsm` / `asmToSource`, and `navigateBy` metric ids matching column ids. Assembly `metricsColumns` order is Address · Assembly · Instructions Executed · Sampling Stall · Warp Occupancy (`text` for Address/Assembly).

## Acceptance Criteria

1. **PR-SRC-001** — `adaptSourceCorrelation` returns null on `out.rep` payloads.
2. **PR-SRC-002** — `mockSourceCorrelation` is deterministic with `mock: true` and bidirectional maps.
3. **PR-SRC-003** — `adaptRep(out.rep)` fills `sourceCorrelation` (mock) and includes `'sourceTab'`.
4. **PR-SRC-004** — `adaptChromeTrace` omits `sourceCorrelation` and `'sourceTab'`.
5. **PR-SRC-005** — gather_2d compute embeds (`objdump` + `symbolizer` + `summary.db` + `.asc`) yield `mock: false` with AscendC source text and asm stall metrics from `pc_sampling`.
6. **PR-SRC-006** — symbolizer `Line > 0` fills `sourceToAsm` / `asmToSource` (basename match on `FileName`); `Line: 0` stays unmapped (DATA-54 interim).
7. **PR-SRC-007** — `parseObjdump` extracts instruction rows from the gather_2d listing.
8. **PR-SRC-008** — `loadReportSource(gather_2d.npu-rep)` (leaf with `.asc` embed) yields `sourceCorrelation.mock === false` and non-empty maps.

## Dependencies

[UI-37](../../docs/context/decisions/UI.md), [VIEW_DATA_REQUIREMENTS §15](../../docs/formats/VIEW_DATA_REQUIREMENTS.md), [view-models](./view-models.spec.md), [DATA-52](../../docs/context/questions/DATA.md)–[DATA-55](../../docs/context/questions/DATA.md).

## Changelog

- **2026-10-15** — Refresh gather_2d fixtures (symbolizer Line>0); `gather_2d.npu-rep` playground pack; PR-SRC-006/008; npu-compute PDF column list → DATA-55.
- **2026-10-15** — Compute multi-file adapt (`objdump` / `symbolizer` / `summary.db` / `.asc`); sql.js `pc_sampling` reader; PR-SRC-005–007.
- **2026-10-14** — Mock SASS density (≥40 rows), sketch-scale stalls, kernel-ABI assembly `path`.
- **2026-10-07** — Initial mock-first Source correlation adapter.
