# Source Correlation

| spec-id-prefix |
|----------------|
| PR-SRC-*       |

Adapt report-pack payloads into `SourceCorrelationModel` for the 源码 tab (UI-37), with a deterministic mock when real embeds are absent.

```ts
adaptSourceCorrelation(payloads: Record<string, Uint8Array>): SourceCorrelationModel | null
mockSourceCorrelation(): SourceCorrelationModel
```

## Unit contract

- Line numbers are **1-based**.
- Correlation keys use `` `${fileId}:${line}` ``.
- `mock: true` only on the deterministic fixture; real embeds set `mock: false`.

## Behavior

**Real path.** `adaptSourceCorrelation` looks up known embed basenames (`SourceCorrelation.json`, aliases). When none exist — or the Product schema is not yet implemented — it returns `null`.

**Mock fallback.** Report-pack adapters (`adaptPayloads`, `adaptEmulate`) assign `reportModel.sourceCorrelation = adapt(...) ?? mockSourceCorrelation()` and push capability `'sourceTab'`.

**Chrome Trace–only.** `emptyReportViewModel` / `adaptChromeTrace` omit `sourceCorrelation` and do not advertise `'sourceTab'`.

**Mock shape.** At least one AscendC source file (`language: 'ascend-c'`; Sudu ≥ `0.0.130-alpha4`, ≥100 lines), one assembly buffer (≥40 SASS rows, kernel-ABI `path` like `sharpen[abi:…]`, sketch-scale Sampling Stall), non-empty `sourceToAsm` / `asmToSource`, and `navigateBy` metric ids matching column ids. Assembly `metricsColumns` order is Address · Assembly · Instructions Executed · Sampling Stall · Warp Occupancy (`text` for Address/Assembly).

## Acceptance Criteria

1. **PR-SRC-001** — `adaptSourceCorrelation` returns null on `out.rep` payloads.
2. **PR-SRC-002** — `mockSourceCorrelation` is deterministic with `mock: true` and bidirectional maps.
3. **PR-SRC-003** — `adaptRep(out.rep)` fills `sourceCorrelation` (mock) and includes `'sourceTab'`.
4. **PR-SRC-004** — `adaptChromeTrace` omits `sourceCorrelation` and `'sourceTab'`.

## Dependencies

[UI-37](../../docs/context/decisions/UI.md), [VIEW_DATA_REQUIREMENTS §15](../../docs/formats/VIEW_DATA_REQUIREMENTS.md), [view-models](./view-models.spec.md).

## Changelog

- **2026-10-14** — Mock SASS density (≥40 rows), sketch-scale stalls, kernel-ABI assembly `path`.
- **2026-10-07** — Initial mock-first Source correlation adapter.
