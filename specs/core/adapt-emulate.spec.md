# Adapt Emulate

| spec-id-prefix |
|----------------|
| PR-ASIM-*      |

Map emulate leaf payloads into canonical `AdaptedReport` (`SwimlaneModel` + `ReportViewModel` + `capabilities`). Descriptive SSOT: [ADAPTERS.md](../../docs/formats/ADAPTERS.md) §4. Unification gaps: [VIEW_DATA_REQUIREMENTS.md](../../docs/formats/VIEW_DATA_REQUIREMENTS.md) profile fill.

```ts
adaptEmulate(payloads: Record<string, Uint8Array>): AdaptedReport
```

## Behavior

**Dispatch.** Invoked when `loadReportSource` detects `EmulateManifest.json` with emulate profile ([PROC-8](../../docs/context/decisions/PROC.md)).

**Swimlane.** Build `SwimlaneModel` from `PipeTrace.json` via `chromeTraceToSwimlane` with `sourceTimeUnit: 'us'` ([DATA-41](../../docs/context/decisions/DATA.md)).

**Thin summary.** When KernelInfo/summary payloads are present and mappable, fill `reportModel.summary` identity/duration fields (interim [DATA-42a](../../docs/context/decisions/interim/DATA.md)); otherwise leave summary empty/partial and let UI hide cards ([DATA-30](../../docs/context/decisions/DATA.md)).

**PIPE occupancy (Sept 30).** When `PipeUtilizationHist.csv` or `PipesUtilization.csv` is present, map into `pipeOccupancy` / `computeTables` without inventing `PipeUtilization.csv` ([DATA-40](../../docs/context/decisions/DATA.md)). Prefer hist `PipeName`+`Utilization`.

**Omit gap panels.** Do not populate `overviewSeries`, `memoryTopology`, `roofline`, or `hardwareDetails` from invented compute CSVs.

**Capabilities.** Typically empty or `dependencies` when present. Do not set `memoryDiagram` / `roofline` until dedicated mappers exist.

**Errors.** Corrupt marker or unparseable PipeTrace → throw. Missing optional analytics embeds → omit fields, do not throw.

## Acceptance Criteria

1. **PR-ASIM-001** — `adaptEmulate` produces non-null `swimlaneModel` from valid emulate `PipeTrace.json` (µs).
2. **PR-ASIM-002** — Without pipe util embeds, `pipeOccupancy` is empty and no synthetic `PipeUtilization.csv` is required; with `PipesUtilization` / hist, `pipeOccupancy` is non-empty.
3. **PR-ASIM-003** — Missing KernelInfo/summary yields AdaptedReport without hard error (timeline-only aside hide).
4. **PR-ASIM-004** — Does not invent compute-shaped metric CSV payloads ([DATA-40](../../docs/context/decisions/DATA.md)).
5. **PR-ASIM-005** — Interim DATA-42a maps KernelInfo/summary.json into `summary.opName` / `taskDurationUs` when attrs present.

## Edge Cases

- Marker + PipeTrace only → valid Sept 30 timeline-only report.
- Compute leaf passed to adaptEmulate → out of scope (dispatcher must not call).

## Dependencies

[emulate-format](./emulate-format.spec.md), [view-models](./view-models.spec.md), [swimlane-model](./swimlane-model.spec.md), [load-report-source](./load-report-source.spec.md).

## Open

DATA-42 — Product-final summary field mapping (interim DATA-42a).

## Changelog
- **2026-09-14** — Initial spec (docs pass; tests todo).
- **2026-09-15** — Sept 30 PIPE + interim summary; rename emulate.
