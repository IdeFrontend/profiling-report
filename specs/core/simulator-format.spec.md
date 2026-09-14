# Simulator Format

| spec-id-prefix |
|----------------|
| PR-SIM-*       |

Contract for a **simulator** payload profile leaf inside product `.npu-rep` (npu_emulate). Descriptive SSOT: [simulator/FORMAT.md](../../docs/formats/simulator/FORMAT.md).

## Behavior

**Marker.** A simulator leaf MUST embed `SimulatorManifest.json` with `profile` equal to `"simulator"` and integer `schemaVersion` ≥ 1 ([PROC-8](../../docs/context/decisions/PROC.md)).

**Phase 1 required embeds.** In addition to the marker: `PipeTrace.json` (Chrome Trace Event format). At least one of `KernelInfo.csv` or `summary.json` SHOULD be present for thin summary; absence yields timeline-only (null/empty summary cards per DATA-30), not a hard error.

**Time unit.** `PipeTrace.json` `ts` / `dur` MUST be in **microseconds** after producer tick→µs conversion ([DATA-46](../../docs/context/decisions/DATA.md)). The viewer MUST NOT treat PipeTrace values as raw ticks.

**No hardware remap.** The leaf MUST NOT be required to contain hardware-shaped `OpBasicInfo.csv` / `PipeUtilization.csv` / `Memory.csv` for valid open ([DATA-45](../../docs/context/decisions/DATA.md)).

**Phase 2 embeds.** Optional CSVs listed in FORMAT §4.2 may be packed; capabilities are set only when data is present.

## Acceptance Criteria

1. **PR-SIM-001** — `SimulatorManifest.json` with `profile: "simulator"` and `schemaVersion` is required to classify a leaf as simulator.
2. **PR-SIM-002** — Phase 1 leaf with marker + `PipeTrace.json` is a valid simulator pack even without hardware metric CSVs.
3. **PR-SIM-003** — Simulator `PipeTrace.json` is documented/contracted as µs (producer converts ticks); viewer contract matches hardware PipeTrace µs rule.
4. **PR-SIM-004** — Missing KernelInfo/summary does not invalidate the leaf (timeline-only).

## Edge Cases

- Marker present but corrupt JSON → hard error at parse.
- Marker absent → hardware path (not this spec).
- Empty PipeTrace / no complete events → fail in chromeTraceToSwimlane (same as hardware).

## Dependencies

[INPUT_FORMATS.md](../../docs/formats/INPUT_FORMATS.md), [simulator/FORMAT.md](../../docs/formats/simulator/FORMAT.md), PROC-6…8, DATA-45, DATA-46. [adapt-simulator](./adapt-simulator.spec.md).

## Open

[DATA-47](../../docs/context/questions/DATA.md) — KernelInfo/summary → summary field map.

## Changelog
- **2026-09-14** — Initial spec (docs pass; tests todo).
