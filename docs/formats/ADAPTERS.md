# Adapters — detect, dispatch

Hub for **how on-disk payloads become** `SwimlaneModel` + `ReportViewModel` + `capabilities[]`.

Container / profiles: [README.md](README.md). Compute schemas: [compute/FORMAT.md](compute/FORMAT.md). Emulate: [emulate/FORMAT.md](emulate/FORMAT.md). **Per-surface fills:** [`../views/`](../views/).

---

## 1. Detection and dispatch

```text
bytes
  → parse container (npu-rep / cann-rep / standalone CTEF)
  → leaf payloads (name → Uint8Array)
  → if EmulateManifest.json with profile=="emulate"
        → adaptEmulate(payloads)
     else
        → adaptCompute(payloads)   // adaptPayloads
  → AdaptedReport { swimlaneModel, reportModel, capabilities, … }
```

| Signal | Profile | Entry |
|--------|---------|--------|
| Standalone Chrome Trace `.json` | (trace-only) | `adaptChromeTrace` — empty report model ([PROC-3](../context/decisions/PROC.md)) |
| Leaf has `EmulateManifest.json` | `emulate` | `adaptEmulate` ([PROC-8](../context/decisions/PROC.md)) |
| Otherwise | `compute` | `adaptPayloads` / `adaptCompute` |

Do **not** invent compute CSVs from emulate tables ([DATA-45](../context/decisions/DATA.md)).

---

## 2. Capability → view packet

| Capability / surface | View packet | Compute | Emulate Sept 30 |
|----------------------|-------------|---------|-----------------|
| Timeline | [timeline](../views/timeline.md) | PipeTrace / trace | PipeTrace (µs) **in** |
| Summary cards | [report-summary](../views/report-summary.md) | OpBasicInfo + Summary.jsonl | KernelInfo/summary **in** (thin) |
| PIPE bars | [pipe-occupancy](../views/pipe-occupancy.md) | PipeUtilization | PipesUtilization / hist **in** |
| Overview | [overview-charts](../views/overview-charts.md) | Sampling.json | **hide** (gap) |
| `roofline` | [roofline](../views/roofline.md) | Arithmetic + Memory | **hide** (gap) |
| `memoryDiagram` | [memory-topology](../views/memory-topology.md) | Memory* | **hide** (gap) |
| `hardwareDetails` | _(stub)_ | HardwareInfo | usually omit |
| `archDiagram` / `memoryHeatmap` / `vfIpc` / `callStacks` | reserved | — | **out-of-scope** |

Fill tables live in the view packets — do not duplicate them here.

---

## 3. Implementation notes

- Code: `loadReportSource` → `isEmulateLeaf` ? `adaptEmulate` : `adaptPayloads`. `parseNpuRep160` requires `origin === 1`.
- Sample emulate leaf: `data/emulate-sample.npu-rep`.
- Packer (npu_emulate): emit `EmulateManifest.json`; convert ticks → µs for PipeTrace ([DATA-46](../context/decisions/DATA.md)).
