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

**Swimlane.** When `PipeTrace.json` **or** one or more native `*_tracing_report_*.json` embeds are present, build `SwimlaneModel` via `chromeTraceToSwimlane` with `sourceTimeUnit: 'us'` ([DATA-46](../../docs/context/decisions/interim/DATA.md#data-46)). Multiple native core reports are **merged** with remapped pids ([PR-ASIM-007](#acceptance-criteria)). When absent, `swimlaneModel` is **null** (open still succeeds). Corrupt Trace JSON → throw.

**Summary chrome.** Emulate does **not** populate `reportModel.summary` from KernelInfo (or any embed). Set `reportModel.profile: 'emulate'`. Aside omits summary cards and the pid / opType / Blocks / 更多 meta row ([DATA-47](../../docs/context/decisions/DATA.md)). KernelInfo may still be packed in `csvTexts` when present.

**PIPE occupancy (Sept 30 / M4).** When `PipeUtilizationHist.csv` or `PipesUtilization.csv` is present, map into `pipeOccupancy` / `computeTables` without inventing `PipeUtilization.csv` ([DATA-45](../../docs/context/decisions/interim/DATA.md#data-45)). Prefer hist `PipeName`+`Utilization`.

**Architecture Diagram (Sept 30 / M4).** When `ArchDiagramMetrics.csv` is present, map into the **shared** `memoryTopology` carrier (same chrome / panel as compute) + `memoryTables` via interim [DATA-48a](../../docs/context/decisions/interim/DATA.md) / `ARCH_DIAGRAM_EDGE_MAP` (corridor **bases**; suffix by metric mode). Adapter snapshot defaults to `bandwidth_per_operator` (`*_gbs`); the aside rebuilds labels for `bandwidth_per_request` / `number_of_requests`. Dual AIV0/AIV1: **sum** gbs/cnt, **unweighted average** of scalar `*_ratio` (not (Σnum)/(Σden) — DATA-48a). Do **not** invent a second topology VM or chrome. Do **not** use `MemoryRWAccesses` (heatmap — [DATA-49](../../docs/context/questions/DATA.md)). Omit diagram when nothing drawable.

**Omit gap panels.** Do not populate `overviewSeries`, `roofline`, or `hardwareDetails` from invented compute CSVs. Do not invent FLOPS/BW summary cards.

**Capabilities.** `dependencies` when present; **`archDiagram`** when ArchDiagramMetrics yields drawable `memoryTopology`. Do not set `memoryDiagram` for emulate (that flag is compute Asc 内存负载). Do not set `roofline` until a dedicated mapper exists.

**Errors.** Corrupt marker or unparseable PipeTrace → throw. Missing PipeTrace or optional analytics embeds → omit fields / null swimlane, do not throw.

## Acceptance Criteria

1. **PR-ASIM-001** — `adaptEmulate` produces non-null `swimlaneModel` from valid emulate `PipeTrace.json` (µs).
2. **PR-ASIM-002** — Without pipe util embeds, `pipeOccupancy` is empty and no synthetic `PipeUtilization.csv` is required; with `PipesUtilization` / hist, `pipeOccupancy` is non-empty.
3. **PR-ASIM-003** — Missing or present KernelInfo yields AdaptedReport without hard error; summary chrome stays empty.
4. **PR-ASIM-004** — Does not invent compute-shaped metric CSV payloads ([DATA-45](../../docs/context/decisions/interim/DATA.md#data-45)).
5. **PR-ASIM-005** — `reportModel.summary` is `{}` and `profile` is `'emulate'` even when KernelInfo attrs are present ([DATA-47](../../docs/context/decisions/DATA.md)).
6. **PR-ASIM-006** — Missing Trace → `swimlaneModel === null` without throw; corrupt Trace JSON → throw.
7. **PR-ASIM-007** — When `PipeTrace.json` is absent, every native `core_*_tracing_report_*.json` (non–critical-path) is merged into one swimlane; pids are remapped so cores that each use `pid: 0` stay distinct. Cores are ordered by numeric core index when the basename matches `core_<n>_…`.
8. **PR-ASIM-008** — `ArchDiagramMetrics.csv` → drawable `memoryTopology` + capability **`archDiagram`**; empty/unmapped → omit (DATA-48a). Do not set `memoryDiagram` on emulate.
9. **PR-ASIM-008b** — `ARCH_DIAGRAM_EDGE_MAP` edge ids ⊆ `TOPOLOGY_SLOT_EDGE_IDS`; every mapped corridor **base** is outside `ARCH_DIAGRAM_UNPLATED_HTML_BASES` (no `_gbs`/`_ratio`/`_cnt` in the map); a full ArchDiagramMetrics fixture labels all plated edges + L2 peak (AIV pairs **sum** for gbs/cnt; **unweighted average** for ratio); metric modes rebuild labels; EAV headers case-insensitive.

## Edge Cases

- Marker + PipeTrace only → valid Sept 30 timeline-only report.
- Marker without PipeTrace → valid open, empty timeline.
- Compute leaf passed to adaptEmulate → out of scope (dispatcher must not call).

## Dependencies

[emulate-format](./emulate-format.spec.md), [view-models](./view-models.spec.md), [swimlane-model](./swimlane-model.spec.md), [load-report-source](./load-report-source.spec.md).

## Open

DATA-48 — Product-final ArchDiagramMetrics → Architecture Diagram slot map (interim DATA-48a).
DATA-49 — Dedicated ArchDiagramModel / biprof chrome vs heatmap deferral.

## Changelog
- **2026-09-24** — DATA-48a ratio merge spelled as unweighted average; EAV headers case-insensitive (PR-ASIM-008b).
- **2026-09-23** — DATA-48a metric modes + AIV sum (gbs/cnt) / average (ratio); PR-ASIM-008b AC aligned.
- **2026-09-14** — Initial spec (docs pass; tests todo).
- **2026-09-15** — Sept 30 PIPE + interim summary; rename emulate.
- **2026-09-15** — `manifest.json` detection; optional PipeTrace (PR-ASIM-006).
- **2026-09-17** — M4 ArchDiagramMetrics → interim plated chrome (PR-ASIM-008 / DATA-48a).
- **2026-09-17** — Product lock: capability `archDiagram` (not `memoryDiagram`); heatmap out (DATA-49).
- **2026-09-17** — PR-ASIM-007: multi-core native tracing reports merged with remapped pids.
- **2026-09-18** — DATA-47: no summary cards / meta for emulate; drop KernelInfo → summary map.
