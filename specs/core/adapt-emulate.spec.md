# Adapt Emulate

| spec-id-prefix |
|----------------|
| PR-ASIM-*      |

Map emulate leaf payloads into canonical `AdaptedReport` (`SwimlaneModel` + `ReportViewModel` + `capabilities`). Descriptive SSOT: [ADAPTERS.md](../../docs/formats/ADAPTERS.md) §4. Unification gaps: [VIEW_DATA_REQUIREMENTS.md](../../docs/formats/VIEW_DATA_REQUIREMENTS.md) profile fill.

```ts
adaptEmulate(payloads: Record<string, Uint8Array>): AdaptedReport
```

## Behavior

**Dispatch.** Invoked when `loadReportSource` detects emulate `manifest.json` ([PROC-8](../../docs/context/decisions/PROC.md)).

**Swimlane.** When `PipeTrace.json` **or** a native `*_tracing_report_*.json` is present, build `SwimlaneModel` via `chromeTraceToSwimlane` with `sourceTimeUnit: 'us'` ([DATA-46](../../docs/context/decisions/DATA.md)). When absent, `swimlaneModel` is **null** (open still succeeds). Corrupt Trace JSON → throw.

**Thin summary.** When KernelInfo/summary payloads are present and mappable, fill `reportModel.summary` identity/duration fields (interim [DATA-47a](../../docs/context/decisions/interim/DATA.md)); otherwise leave summary empty/partial and let UI hide cards ([DATA-30](../../docs/context/decisions/DATA.md)).

**PIPE occupancy (Sept 30 / M4).** When `PipeUtilizationHist.csv` or `PipesUtilization.csv` is present, map into `pipeOccupancy` / `computeTables` without inventing `PipeUtilization.csv` ([DATA-45](../../docs/context/decisions/DATA.md)). Prefer hist `PipeName`+`Utilization`.

**Architecture Diagram (Sept 30 / M4).** When `ArchDiagramMetrics.csv` is present, map into `memoryTopology` (interim VM carrier) + `memoryTables` via interim [DATA-48a](../../docs/context/decisions/interim/DATA.md). Do **not** use `MemoryRWAccesses` (heatmap — [DATA-49](../../docs/context/questions/DATA.md)). Omit diagram when nothing drawable.

**Omit gap panels.** Do not populate `overviewSeries`, `roofline`, or `hardwareDetails` from invented compute CSVs. Do not invent FLOPS/BW summary cards.

**Capabilities.** `dependencies` when present; **`archDiagram`** when ArchDiagramMetrics yields drawable `memoryTopology`. Do not set `memoryDiagram` for emulate (that flag is compute Asc 内存负载). Do not set `roofline` until a dedicated mapper exists.

**Errors.** Corrupt marker or unparseable PipeTrace → throw. Missing PipeTrace or optional analytics embeds → omit fields / null swimlane, do not throw.

## Acceptance Criteria

1. **PR-ASIM-001** — `adaptEmulate` produces non-null `swimlaneModel` from valid emulate `PipeTrace.json` (µs).
2. **PR-ASIM-002** — Without pipe util embeds, `pipeOccupancy` is empty and no synthetic `PipeUtilization.csv` is required; with `PipesUtilization` / hist, `pipeOccupancy` is non-empty.
3. **PR-ASIM-003** — Missing KernelInfo/summary yields AdaptedReport without hard error (timeline-only aside hide).
4. **PR-ASIM-004** — Does not invent compute-shaped metric CSV payloads ([DATA-45](../../docs/context/decisions/DATA.md)).
5. **PR-ASIM-005** — Interim DATA-47a maps KernelInfo/summary.json into `summary.opName` / `taskDurationUs` when attrs present.
6. **PR-ASIM-006** — Missing Trace → `swimlaneModel === null` without throw; corrupt Trace JSON → throw.
7. **PR-ASIM-007** — Native `core_*_tracing_report_*.json` is used when `PipeTrace.json` is absent.
8. **PR-ASIM-008** — `ArchDiagramMetrics.csv` → drawable `memoryTopology` + capability **`archDiagram`**; empty/unmapped → omit (DATA-48a). Do not set `memoryDiagram` on emulate.

## Edge Cases

- Marker + PipeTrace only → valid Sept 30 timeline-only report.
- Marker without PipeTrace → valid open, empty timeline.
- Compute leaf passed to adaptEmulate → out of scope (dispatcher must not call).

## Dependencies

[emulate-format](./emulate-format.spec.md), [view-models](./view-models.spec.md), [swimlane-model](./swimlane-model.spec.md), [load-report-source](./load-report-source.spec.md).

## Open

DATA-47 — Product-final summary field mapping (interim DATA-47a).
DATA-48 — Product-final ArchDiagramMetrics → Architecture Diagram slot map (interim DATA-48a).
DATA-49 — Dedicated ArchDiagramModel / biprof chrome vs heatmap deferral.

## Changelog
- **2026-09-14** — Initial spec (docs pass; tests todo).
- **2026-09-15** — Sept 30 PIPE + interim summary; rename emulate.
- **2026-09-15** — `manifest.json` detection; optional PipeTrace (PR-ASIM-006).
- **2026-09-17** — M4 ArchDiagramMetrics → interim plated chrome (PR-ASIM-008 / DATA-48a).
- **2026-09-17** — Product lock: capability `archDiagram` (not `memoryDiagram`); heatmap out (DATA-49).
