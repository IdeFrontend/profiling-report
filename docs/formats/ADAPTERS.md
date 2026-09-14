# Adapters — detect, dispatch, fill view-models

Hub for **how on-disk payloads become** `SwimlaneModel` + `ReportViewModel` + `capabilities[]`.

Container / profiles: [INPUT_FORMATS.md](INPUT_FORMATS.md). Hardware schemas: [hardware/FORMAT.md](hardware/FORMAT.md). Simulator: [simulator/FORMAT.md](simulator/FORMAT.md). UI hide rules (adapted fields): [VIEW_DATA_REQUIREMENTS.md](VIEW_DATA_REQUIREMENTS.md). Architecture: [ARCHITECTURE.md](../architecture/ARCHITECTURE.md).

Split into [hardware/ADAPTERS.md](hardware/ADAPTERS.md) / [simulator/ADAPTERS.md](simulator/ADAPTERS.md) only if field-fill tables outgrow this hub.

---

## 1. Detection and dispatch

```text
bytes
  → parse container (npu-rep / cann-rep / standalone CTEF)
  → leaf payloads (name → Uint8Array)
  → if SimulatorManifest.json with profile=="simulator"
        → adaptSimulator(payloads)
     else
        → adaptHardware(payloads)   // today’s adaptPayloads
  → AdaptedReport { swimlaneModel, reportModel, capabilities, … }
```

| Signal | Profile | Entry |
|--------|---------|--------|
| Standalone Chrome Trace `.json` | (trace-only) | `adaptChromeTrace` — empty report model ([PROC-3](../context/decisions/PROC.md)) |
| Leaf has `SimulatorManifest.json` | `simulator` | `adaptSimulator` ([PROC-8](../context/decisions/PROC.md)) |
| Otherwise | `hardware` | `adaptPayloads` / hardware path |

Do **not** invent hardware CSVs from simulator tables ([DATA-45](../context/decisions/DATA.md)).

---

## 2. Capability matrix

| Capability | Hardware fill | Simulator fill | UI |
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

## 3. Hardware → view-model (summary)

Normative detail lives in [view-models.spec.md](../../specs/core/view-models.spec.md) and [hardware/METRICS_AND_TRACE.md](hardware/METRICS_AND_TRACE.md).

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

## 4. Simulator → view-model (Phase 1)

| Adapted field | Sources | Rules |
|---------------|---------|-------|
| `SwimlaneModel` | `PipeTrace.json` | Same Chrome Trace → swimlane path; **sourceTimeUnit: `us`** ([DATA-46](../context/decisions/DATA.md)) |
| `summary.taskDurationUs` / identity | `KernelInfo.csv` and/or `summary.json` | Best-effort; exact map [DATA-47](../context/questions/DATA.md). Omit cards when unmappable |
| `pipeOccupancy` | — | **Omit** Phase 1 (hide PIPE panel) |
| `overviewSeries` | — | **Omit** unless counters packed |
| `memoryTopology` / `roofline` / `hardwareDetails` | — | **Omit** |
| `capabilities` | marker + present embeds | Phase 1: typically `[]` or timeline-only; add Phase 2 flags when embeds exist |

Missing optional adapted fields → hide UI ([DATA-30](../context/decisions/DATA.md)); do not throw.

---

## 5. Simulator Phase 2 fills (reserved)

When product packs the embeds in [simulator/FORMAT.md](simulator/FORMAT.md) §4.2, set the matching capability and fill dedicated models (may extend `ReportViewModel` later). Until then, document sources only — no requirement to invent VM types in this docs pass.

---

## 6. Implementation notes (not this docs slice)

- Today’s code: `loadReportSource` → `adaptPayloads` only; `parseNpuRep160` requires `origin === 1`.
- Next engineering slice: detect marker → `adaptSimulator`; keep hardware path unchanged.
- Packer (npu_emulate side): emit Phase 1 leaf; convert ticks → µs for PipeTrace.
