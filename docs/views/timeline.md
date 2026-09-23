# Timeline

| | |
|--|--|
| **Id** | `timeline` |
| **Panel / component** | `ProfilingReport` / `TimelineView` / `SwimlaneCanvas` → `src/ui/ProfilingReport/`, `src/ui/TimelineView/` |
| **Capability** | _(none)_ — shell; optional `dependencies` for P2 links |
| **Phase** | M |
| **Unification** | `same-path` (`chromeTraceToSwimlane`) |
| **Sept 30 (emulate)** | **in** |

## Sketches

![Entry / timeline chrome](../ui/source/v930/entry.jpeg)

![Task hover](../ui/source/v930/task-hover.jpeg)

![Task click detail](../ui/source/v930/task-click-detail.jpeg)

## Purpose

Primary Gantt / swimlane of OP execution over time. Opens from `.npu-rep` or standalone Chrome Trace; aside analytics are independent.

<a id="entry-op-shell"></a>

## Entry / OP selector (docx §11.2.2)

![Entry overview](../ui/source/v930/entry.jpeg)

| # | UI | Behavior / data |
| --- | --- | --- |
| 1 | Report file | Open `report_<timestamp>_<rand id>.npu-rep` (product). Clicking the report opens the visualization pane. |
| 2 | OP 算子 selector | Choose among operators / kernels packaged in the report (docx: “npu-rep 中包含的 … 文件个数的选择”). Drives which metric rows / nested payloads feed all downstream views. |

**Rendering rules**

- Left explorer shows profiling run folders; selecting the report file loads the viewer.
- Top dropdown filters the active OP / kernel name.
- Main chrome includes tabs such as 时间线 / 源码 / 详情 / 缓存 (exact tab set follows product design; timeline is the primary swimlane surface).

Owning root ACs: [ProfilingReport.spec.md](../../src/ui/ProfilingReport/ProfilingReport.spec.md) (multi-op OP selector **PR-ROOT-005**).

## View-model

| Field | Role | Required? |
|-------|------|-----------|
| `SwimlaneModel` (`processes`, `minTime`, `maxTime`) | Lanes + time range | **Required** for Timeline |
| `ReportViewModel` | Aside analytics | Optional — Timeline works without |
| `capabilities` | Gates P2 surfaces | Optional |

Minimum: parseable Chrome Trace → non-empty time range (lanes may be thin).

## Hide rule

Hard error only if the source cannot be parsed. Empty events → empty lanes (still valid). Aside panels hide independently ([DATA-30](../context/decisions/DATA.md)).

## Compute fill

| Adapted field | Embed | Columns / notes | Schema SSOT |
|---------------|-------|-----------------|-------------|
| `SwimlaneModel` | Prefer `trace.json` (ns); else `PipeTrace.json` (µs→ns ×1000) | CTEF `ph:X` events | [compute/FORMAT](../formats/compute/FORMAT.md), [METRICS](../formats/compute/METRICS_AND_TRACE.md) |

<a id="structure"></a>

### Structure (docx §11.2.8)

| UI region | Content |
| --- | --- |
| Left tree | Hierarchical **Card** → 通信 / 计算 / 储存HBM → `CoreN.Cube` / `CoreN.Vec*` → pipes (`ALL`, `SCALAR`, `FLOWCTRL`, `MTE1/2/3`, `CUBE`, `FIXP`, `CACHEMISS`, …) with utilization % bars. Only Card is a group header; nested folders are lane-style expandable rows |
| Main pane | Gantt / swimlane blocks on a time or **时钟周期** axis |
| Selection | Click block → bottom **详情** ([event-details](event-details.md) §11.2.8.1) |
| Dependencies | Curved connectors between related blocks |

<a id="vm-derivation"></a>

### VM field ← source (join / derivation)

| VM field | Source embed(s) | Join key(s) | Derivation |
|----------|-----------------|-------------|------------|
| processes / threads | CTEF `ph:M` metadata | `pid` / `tid` | `process_name` / `thread_name`; else `Process {pid}` / `tid-{tid}` |
| events | CTEF `ph:X` | _(none)_ | `ts`+`dur` → `startTime`/`duration` in ns |
| event `id` | `args.event_id` if unique | — | else synthetic `e-<seq>` |
| dependencies | `args.dependencies`; async `ph:s`/`f` | pair by id | successor refs on events |
| lane `utilization` | pipe occupancy + thread names | pipe `colorKey` ↔ `laneColorKey(thread.name)` | `withPipeLaneUtilizations` mean ratio |

Code: `swimlaneFromPayloads` → `chromeTraceToSwimlane` → `withPipeLaneUtilizations`.

<a id="sample-binding"></a>

### Sample data binding (local)

Docx field table is **empty**. Behavior from mockups + sample `trace.json`:

| Need | Sample source |
| --- | --- |
| Lane identity | `thread_name` metadata (`AIV0/PIPE_FIX/status`, …) |
| Intervals | `ph:"X"` events (`ts`, `dur`, `name`, `cat`, `args`) |
| Pipe busy states | `args.state_PIPE_*` on pipe-state records |

Utilization % per row and nested `ProfilerStep#*` / ISA-like labels in the mockup exceed the sample trace richness — full binding remains TBD.

## Emulate fill

| Adapted field | Embed | Columns / notes | Status |
|---------------|-------|-----------------|--------|
| `SwimlaneModel` | Prefer `PipeTrace.json` (µs); else `*_tracing_report_*.json` (not critical_path) | Producer converts ticks → µs ([DATA-46](../context/decisions/interim/DATA.md#data-46)) | `same-path` |

<a id="emulate-vm-derivation"></a>

### Emulate VM field ← source (join / derivation)

| VM field | Source embed(s) | Join key(s) | Derivation |
|----------|-----------------|-------------|------------|
| `SwimlaneModel` | `PipeTrace.json` or native tracing JSON | _(same CTEF path)_ | `sourceTimeUnit: 'us'`; multi-file traces → `mergeNativeChromeTraces` (remap pids) |
| events / lanes | same as compute CTEF | — | `chromeTraceToSwimlane` |
| null swimlane | — | — | No trace embed → metrics-only report (no hard error) |

Code: `adaptEmulate` + `findEmulateTracePayload`.

## Adapter

| Profile | Entry | Notes |
|---------|-------|-------|
| compute | `adaptCompute` / `adaptPayloads` | Prefers `trace.json` (ns); else `PipeTrace.json` (µs) — `swimlaneFromPayloads` |
| emulate | `adaptEmulate` | Requires `manifest.json`; PipeTrace optional (absent → null swimlane) |
| CTEF-only | `adaptChromeTrace` | Empty report model ([PROC-3](../context/decisions/PROC.md)) |

## Related

- UX: [UX_SPEC](../ui/UX_SPEC.md) S1, S10
- FEATURE_MATRIX: Timeline / open `.npu-rep`
- Specs: [ProfilingReport.spec.md](../../src/ui/ProfilingReport/ProfilingReport.spec.md), [SwimlaneCanvas.spec.md](../../src/ui/TimelineView/SwimlaneView/SwimlaneCanvas/SwimlaneCanvas.spec.md)
- Product docx §: 11.2.2 (entry / OP), 11.2.8 (structure + binding)
- Decisions: [DATA-46](../context/decisions/interim/DATA.md#data-46), [PROC-3](../context/decisions/PROC.md), [PROC-8](../context/decisions/PROC.md)
