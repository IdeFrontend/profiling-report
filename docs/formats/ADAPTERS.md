# Adapters — detect, dispatch

Hub for **how on-disk payloads become** `SwimlaneModel` + `ReportViewModel` + `capabilities[]`.

Container / profiles: [README.md](README.md). Compute schemas: [compute/FORMAT.md](compute/FORMAT.md). Source \| SASS: [compute/objdump.txt.md](compute/objdump.txt.md) / [symbolizer.json.md](compute/symbolizer.json.md) / [summary.db.md](compute/summary.db.md). Emulate: [emulate/FORMAT.md](emulate/FORMAT.md). **Per-surface fills:** [`../views/`](../views/).

---

## 1. Detection and dispatch

```text
bytes
  → parse container (npu-rep / cann-rep / standalone CTEF)
  → leaf payloads (name → Uint8Array)
  → if manifest.json (emulate profile or export catalog)
        → adaptEmulate(payloads)
     else
        → adaptCompute(payloads)   // adaptPayloads
  → AdaptedReport { swimlaneModel, reportModel, capabilities, … }
```

| Signal | Profile | Entry |
|--------|---------|--------|
| Standalone Chrome Trace `.json` | (trace-only) | `adaptChromeTrace` — empty report model ([PROC-3](../context/decisions/PROC.md)) |
| Leaf has emulate `manifest.json` | `emulate` | `adaptEmulate` ([PROC-8](../context/decisions/PROC.md)) |
| Otherwise | `compute` | `adaptPayloads` / `adaptCompute` |

Do **not** invent compute CSVs from emulate tables ([DATA-45](../context/decisions/interim/DATA.md#data-45)).

**Emulate embeds → lit views (Sept 30):** [emulate/FORMAT Viewer packer](emulate/FORMAT.md#viewer-packer-sept-30) (legacy anchor [#41-embeds-…](emulate/FORMAT.md#41-embeds-used-by-report-visualization-sept-30--m4)).

---

## 2. Capability → view packet

| Capability / surface | View packet | Compute | Emulate Sept 30 |
|----------------------|-------------|---------|-----------------|
| Timeline | [timeline](../views/timeline.md) | [`PipeTrace.json`](compute/PipeTrace.json.md) / [`trace.json`](compute/trace.json.md) | [`PipeTrace.json`](emulate/PipeTrace.json.md) (µs) when present; else null swimlane |
| Summary cards | [report-summary](../views/report-summary.md) | [`OpBasicInfo.csv`](compute/OpBasicInfo.csv.md) + [`summary.jsonl`](compute/summary.jsonl.md) | **out** ([DATA-47](../context/decisions/DATA.md)) |
| PIPE bars | [pipe-occupancy](../views/pipe-occupancy.md) | [`PipeUtilization.csv`](compute/PipeUtilization.csv.md) | [`PipesUtilization.csv`](emulate/PipesUtilization.csv.md) / [`PipeUtilizationHist.csv`](emulate/PipeUtilizationHist.csv.md) **in** |
| Overview | [overview-charts](../views/overview-charts.md) | [`Sampling.json`](compute/Sampling.json.md) | **hide** (gap) |
| `roofline` | [roofline](../views/roofline.md) | [`ArithmeticUtilization.csv`](compute/ArithmeticUtilization.csv.md) + [`Memory.csv`](compute/Memory.csv.md) | **hide** (gap) |
| `memoryDiagram` | [memory-topology](../views/memory-topology.md) | Memory* ([`Memory.csv`](compute/Memory.csv.md) …) | compute only (Asc 内存负载) |
| `archDiagram` | [memory-topology](../views/memory-topology.md) | — | Emulate [`ArchDiagramMetrics.csv`](emulate/ArchDiagramMetrics.csv.md) **in** on the same chrome + `memoryTopology` VM ([DATA-48a](../context/decisions/interim/DATA.md)); not `memoryDiagram` |
| `memoryHeatmap` | [memory-topology](../views/memory-topology.md) | — | [`MemoryHeatmapLayout.csv`](emulate/MemoryHeatmapLayout.csv.md) + [`MemoryHeatmapCells.csv`](emulate/MemoryHeatmapCells.csv.md) (+ [`CoreTypes.csv`](emulate/CoreTypes.csv.md)); own VM / fullscreen right panel (§11.2.3.2); [DATA-50](../context/decisions/DATA.md) / [DATA-51](../context/decisions/DATA.md) |
| Performance hints | [performance-hints](../views/performance-hints.md) | **in** — [`summary.jsonl`](compute/summary.jsonl.md) `PerformanceHints` → `performanceHints` + capability (PR-VM-027 / #177) | **in** — [`HintMessages.csv`](emulate/HintMessages.csv.md) / [`HintTypes.csv`](emulate/HintTypes.csv.md) / [`InstructionHints.csv`](emulate/InstructionHints.csv.md) / [`KernelHints.csv`](emulate/KernelHints.csv.md) / [`SourceLineHints.csv`](emulate/SourceLineHints.csv.md) joined by `adaptEmulate` |
| `hardwareDetails` | _(stub)_ | [`HardwareInfo.jsonl`](compute/HardwareInfo.jsonl.md) | usually omit |
| `sourceTab` / Source correlation | [source](../views/source.md) | compute: [`objdump.txt`](compute/objdump.txt.md) + [`symbolizer.json`](compute/symbolizer.json.md) + [`summary.db`](compute/summary.db.md) (+ optional `.asc` via [`symbolizer.json.md#source-text`](compute/symbolizer.json.md#source-text)) **in**; index [FORMAT](compute/FORMAT.md); otherwise the tab is absent ([UI-37](../context/decisions/UI.md), [DATA-52](../context/questions/DATA.md)) |
| Source freshness warning | [SOURCE_PROVENANCE](SOURCE_PROVENANCE.md) | Compare [`objdump.txt`](compute/objdump.txt.md) interleaved source to matched local files ([DATA-57](../context/decisions/DATA.md#data-57)); host lookup only | **out** — no producer digest / full-source pack for this check ([DATA-53](../context/questions/DATA.md)) |
| `vfIpc` / `callStacks` | reserved | — | **out-of-scope** Sept 30 |

Fill tables live in the view packets — do not duplicate them here.

---

## 3. Implementation notes

- Code: `loadReportSource` → `isEmulateLeaf` ? `adaptEmulate` : `adaptPayloads`. `parseNpuRep160` requires `origin === 1`.
- Sample emulate leaf: `data/gelu.npu-rep` (sole committed fixture / playground sample).
- Packer (npu_emulate): emit `manifest.json`; convert ticks → µs for PipeTrace ([DATA-46](../context/decisions/interim/DATA.md#data-46)).
