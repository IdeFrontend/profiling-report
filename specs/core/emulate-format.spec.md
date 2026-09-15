# Emulate Format

| spec-id-prefix |
|----------------|
| PR-SIM-*       |

Contract for an **emulate** payload profile leaf inside product `.npu-rep` (npu_emulate). Descriptive SSOT: [emulate/FORMAT.md](../../docs/formats/emulate/FORMAT.md).

## Behavior

**Marker.** An emulate leaf MUST embed `manifest.json` that is either (1) thin marker with `profile` equal to `"emulate"` and integer `schemaVersion` ≥ 1, or (2) an export catalog with `objects[]` containing a hub name (`ExecutedInstructions` / `KernelInfo` / `AnalysisState`) ([PROC-8](../../docs/context/decisions/PROC.md)). Legacy `EmulateManifest.json` (thin shape) is accepted.

**Sept 30 embeds.** `PipeTrace.json` (Chrome Trace Event format, µs) **SHOULD** be present for timeline; **absence MUST NOT** invalidate the leaf — viewer opens with `swimlaneModel: null` (metrics-only). At least one of `KernelInfo.csv` or `summary.json` SHOULD be present for thin summary; absence yields empty summary cards per DATA-30. `PipesUtilization.csv` / `PipeUtilizationHist.csv` SHOULD be packed when PIPE UI is expected.

**Time unit.** When present, `PipeTrace.json` `ts` / `dur` MUST be in **microseconds** after producer tick→µs conversion ([DATA-46](../../docs/context/decisions/DATA.md)). The viewer MUST NOT treat PipeTrace values as raw ticks.

**No compute remap.** The leaf MUST NOT be required to contain compute-shaped `OpBasicInfo.csv` / `PipeUtilization.csv` / `Memory.csv` for valid open ([DATA-45](../../docs/context/decisions/DATA.md)).

**Post–Sept 30 embeds.** Optional CSVs listed in FORMAT §4.2 may be packed; capabilities are set only when data is present and mappers exist.

## Acceptance Criteria

1. **PR-SIM-001** — `manifest.json` thin profile+schemaVersion **or** export-catalog hub classifies a leaf as emulate (legacy `EmulateManifest.json` accepted).
2. **PR-SIM-002** — Leaf with marker + `PipeTrace.json` is a valid emulate pack even without compute metric CSVs.
3. **PR-SIM-003** — Emulate `PipeTrace.json` is documented/contracted as µs (producer converts ticks); viewer contract matches compute PipeTrace µs rule.
4. **PR-SIM-004** — Missing KernelInfo/summary does not invalidate the leaf (timeline-only).
5. **PR-SIM-005** — Missing `PipeTrace.json` does not invalidate the leaf (`swimlaneModel` null).

## Edge Cases

- Marker present but corrupt JSON → hard error at parse.
- Marker absent → compute path (not this spec).
- Present but empty/invalid PipeTrace events → fail in chromeTraceToSwimlane (same as compute).
- Corrupt PipeTrace JSON → hard error; absent PipeTrace → null swimlane.

## Dependencies

[INPUT_FORMATS.md](../../docs/formats/README.md), [emulate/FORMAT.md](../../docs/formats/emulate/FORMAT.md), PROC-6…8, DATA-45, DATA-46. [adapt-emulate](./adapt-emulate.spec.md).

## Open

[DATA-47](../../docs/context/questions/DATA.md) — KernelInfo/summary → summary field map.

## Changelog
- **2026-09-14** — Initial spec (docs pass; tests todo).
- **2026-09-15** — Rename emulate; Sept 30 PIPE embeds.
- **2026-09-15** — Marker is `manifest.json` (export catalog or thin profile); PipeTrace optional (PR-SIM-005).
