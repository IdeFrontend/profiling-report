# Adapt Simulator

| spec-id-prefix |
|----------------|
| PR-ASIM-*      |

Map simulator leaf payloads into canonical `AdaptedReport` (`SwimlaneModel` + `ReportViewModel` + `capabilities`). Descriptive SSOT: [ADAPTERS.md](../../docs/formats/ADAPTERS.md) §4.

```ts
adaptSimulator(payloads: Record<string, Uint8Array>): AdaptedReport
```

## Behavior

**Dispatch.** Invoked when `loadReportSource` detects `SimulatorManifest.json` with simulator profile ([PROC-8](../../docs/context/decisions/PROC.md)).

**Swimlane.** Build `SwimlaneModel` from `PipeTrace.json` via `chromeTraceToSwimlane` with `sourceTimeUnit: 'us'` ([DATA-41](../../docs/context/decisions/DATA.md)).

**Thin summary.** When KernelInfo/summary payloads are present and mappable, fill `reportModel.summary` identity/duration fields; otherwise leave summary empty/partial and let UI hide cards ([DATA-30](../../docs/context/decisions/DATA.md)). Exact field map: [DATA-42](../../docs/context/questions/DATA.md).

**Omit Phase 1 panels.** Do not populate `pipeOccupancy`, `overviewSeries`, `memoryTopology`, `roofline`, or `hardwareDetails` from invented hardware CSVs ([DATA-40](../../docs/context/decisions/DATA.md)).

**Capabilities.** Phase 1 typically empty or timeline-only. Phase 2: add `archDiagram`, `memoryHeatmap`, `vfIpc`, `callStacks`, etc. only when corresponding embeds have data.

**Errors.** Corrupt marker or unparseable PipeTrace → throw. Missing optional analytics embeds → omit fields, do not throw.

## Acceptance Criteria

1. **PR-ASIM-001** — `adaptSimulator` produces non-null `swimlaneModel` from valid simulator `PipeTrace.json` (µs).
2. **PR-ASIM-002** — Without hardware CSVs, `pipeOccupancy` is empty/absent and no synthetic `PipeUtilization.csv` is required.
3. **PR-ASIM-003** — Missing KernelInfo/summary yields AdaptedReport without hard error (timeline-only aside hide).
4. **PR-ASIM-004** — Does not invent hardware-shaped metric CSV payloads ([DATA-40](../../docs/context/decisions/DATA.md)).

## Edge Cases

- Marker + PipeTrace only → valid Phase 1 report.
- Hardware leaf passed to adaptSimulator → out of scope (dispatcher must not call).

## Dependencies

[simulator-format](./simulator-format.spec.md), [view-models](./view-models.spec.md), [swimlane-model](./swimlane-model.spec.md), [load-report-source](./load-report-source.spec.md).

## Open

DATA-42 — summary field mapping.

## Changelog
- **2026-09-14** — Initial spec (docs pass; tests todo).
