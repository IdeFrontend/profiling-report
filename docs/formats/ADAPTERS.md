# Adapters — detect, dispatch, fill view-models

Hub for **how on-disk payloads become** `SwimlaneModel` + `ReportViewModel` + `capabilities[]`.

Container / profiles: [INPUT_FORMATS.md](INPUT_FORMATS.md). Compute schemas: [compute/FORMAT.md](compute/FORMAT.md). Emulate: [emulate/FORMAT.md](emulate/FORMAT.md). UI hide rules (adapted fields): [VIEW_DATA_REQUIREMENTS.md](VIEW_DATA_REQUIREMENTS.md). Architecture: [ARCHITECTURE.md](../architecture/ARCHITECTURE.md).

Split into [compute/ADAPTERS.md](compute/ADAPTERS.md) / [emulate/ADAPTERS.md](emulate/ADAPTERS.md) only if field-fill tables outgrow this hub.

---

## 1. Detection and dispatch

```text
bytes
  → parse container (npu-rep / cann-rep / standalone CTEF)
  → leaf payloads (name → Uint8Array)
  → if EmulateManifest.json with profile=="emulate"
        → adaptEmulate(payloads)
     else
        → adaptCompute(payloads)   // today’s adaptPayloads
  → AdaptedReport { swimlaneModel, reportModel, capabilities, … }
```

| Signal | Profile | Entry |
|--------|---------|--------|
| Standalone Chrome Trace `.json` | (trace-only) | `adaptChromeTrace` — empty report model ([PROC-3](../context/decisions/PROC.md)) |
| Leaf has `EmulateManifest.json` | `emulate` | `adaptEmulate` ([PROC-8](../context/decisions/PROC.md)) |
| Otherwise | `compute` | `adaptPayloads` / compute path |

Do **not** invent compute CSVs from emulate tables ([DATA-40](../context/decisions/DATA.md)).

---

## 2. Capability matrix

| Capability | Compute fill | Emulate fill | UI |
|------------|---------------|----------------|-----|
| (timeline) | PipeTrace / trace | PipeTrace (µs) | Swimlane |
| `roofline` | Arithmetic + Memory | Phase 2+ when sim roofline inputs present | RooflinePanel |
| `hardwareDetails` | HardwareInfo / OpBasicInfo | usually absent → omit | 更多 overlay |
| `memoryDiagram` | Memory* topology | Phase 1 omit | Memory topology |
| `dependencies` | trace args when present | PipeDependency when packed | dep links |
| `archDiagram` | — | ArchDiagramMetrics Phase 2 | reserved |
| `memoryHeatmap` | — | MemoryRWAccesses Phase 2 | reserved |
| `vfIpc` | — | VfIPC / VfSimtIPC Phase 2 | reserved |
| `callStacks` | — | Call* Phase 2 (ELF) | reserved |

---

## 3. Compute → view-model (summary)

Normative detail lives in [view-models.spec.md](../../specs/core/view-models.spec.md) and [compute/METRICS_AND_TRACE.md](compute/METRICS_AND_TRACE.md).

| Adapted field | Primary sources |
|---------------|-----------------|
| `SwimlaneModel` | `PipeTrace.json` (µs) or `trace.json` (ns) |
| `summary.*` | `OpBasicInfo.csv`, `Summary.jsonl` `OpInfoSummary` |
| `pipeOccupancy` | `PipeUtilization.csv` |
| `overviewSeries` | `Sampling.json` `ph:C` |
| `bandwidthCards` / `computeCard` | Summary.jsonl / Memory / Arithmetic + HardwareInfo |
| `memoryTopology` | Memory*.csv |
| `csvTexts` / detail tables | metric CSV embeds |

---

## 4. Emulate → view-model (Sept 30)

| Adapted field | Sources | Rules |
|---------------|---------|-------|
| `SwimlaneModel` | `PipeTrace.json` | Same Chrome Trace → swimlane path; **sourceTimeUnit: `us`** ([DATA-41](../context/decisions/DATA.md)) |
| `summary.*` | `KernelInfo.csv` and/or `summary.json` | Interim [DATA-42a](../context/decisions/interim/DATA.md); Product-final [DATA-42](../context/questions/DATA.md). Omit cards when unmappable |
| `pipeOccupancy` + PIPE CSV tab | `PipeUtilizationHist.csv` (prefer) or `PipesUtilization.csv` | Map → shared `PipeOccupancyItem[]` / `computeTables`. **Do not** invent `PipeUtilization.csv` ([DATA-40](../context/decisions/DATA.md)). Prefer hist `PipeName`+`Utilization`; else mean `PipeUtilization` by queue/core |
| `overviewSeries` | — | **Omit** unless counters packed |
| `memoryTopology` / `roofline` / `hardwareDetails` | — | **Omit** (gap — see [VIEW_DATA_REQUIREMENTS](VIEW_DATA_REQUIREMENTS.md) profile fill) |
| `capabilities` | marker + present embeds | Timeline + optional `dependencies`; no `memoryDiagram` / `roofline` until mappers exist |

Missing optional adapted fields → hide UI ([DATA-30](../context/decisions/DATA.md)); do not throw.

---

## 5. Emulate post–Sept 30 fills (reserved)

When product packs the embeds in [emulate/FORMAT.md](emulate/FORMAT.md) §4.2, set the matching capability and fill dedicated models (may extend `ReportViewModel` later). Until then, document sources only.

---

## 6. Implementation notes

- Dispatch: `loadReportSource` → leaf `isEmulateLeaf` ? `adaptEmulate` : `adaptCompute` (`adaptPayloads`). `parseNpuRep160` requires `origin === 1`.
- Packer (npu_emulate side): emit leaf with `EmulateManifest.json`; convert ticks → µs for PipeTrace.
- Sample leaf: `data/emulate-sample/` (+ packed `.npu-rep` via `data/scripts/pack_rep.py`).
