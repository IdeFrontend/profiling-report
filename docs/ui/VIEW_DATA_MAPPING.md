# Visualization View ↔ Data Mapping

**Role:** Product docx §11.2 可视化界面数据关联 → [view packets](../views/). **Column / field / edge / slot → view-model tables live in those packets**, not here. This file is the docx § index (backward links only).

Container hub: [formats/README.md](../formats/README.md). Compute: [compute/FORMAT.md](../formats/compute/FORMAT.md). Emulate: [emulate/FORMAT.md](../formats/emulate/FORMAT.md). Catalog: [views/README.md](../views/README.md).

Input schemas: [INPUT_FORMATS.md](../formats/INPUT_FORMATS.md). Design hierarchy: [`DESIGN_INDEX.md`](./DESIGN_INDEX.md). Source mockups: [`docs/ui/source/v930/`](./source/v930/).

Design reference (docx): [HDesign mock](https://octo-g.hdesign.huawei.com/developerPreview/developer/index.html#edit&uniqueId=Cbt3Yr1Wzd6zfmVfNkJOYQ-50712&pageId=1001695).

---

## Overview

```mermaid
flowchart LR
  Report[".npu-rep / .rep"] --> Parser
  Parser --> OpSelect["OP / Kernel selector"]
  OpSelect --> Stats["Report statistics"]
  OpSelect --> Roof["Roofline"]
  OpSelect --> Pipe["Pipe occupancy"]
  OpSelect --> Mem["Memory load diagram"]
  OpSelect --> StatTL["Statistical analysis"]
  OpSelect --> Swim["Block timeline"]
  Stats --> Hw["Hardware details"]
  Pipe --> PipeDet["Pipe details"]
  Mem --> MemDet["Memory / L2Cache details"]
  Swim --> EvDet["Event details + Relevant"]
```

---

## Docx § → view packet

| Docx § | Feature | View packet | Phase / notes |
| --- | --- | --- | --- |
| 11.2.2 | Entry / OP selector | _(shell — see [timeline](../views/timeline.md))_ | Report open + OP dropdown drives all aside views |
| 11.2.3 | Report statistics | [report-summary](../views/report-summary.md) | Field map + viz logic + DATA-33h / DATA-8 slots in **Compute fill** |
| 11.2.3.1 | Hardware details | [hardware-details](../views/hardware-details.md) | Section/field table in **Compute fill** |
| 11.2.4 | Roofline | [roofline](../views/roofline.md) | Tabs→fields + DATA-37 interim in **Compute fill** |
| 11.2.5 | PIPE occupancy | [pipe-occupancy](../views/pipe-occupancy.md) | Cube / Vector column tables in **Compute fill** |
| 11.2.5.1 | Compute-load CSV details | [pipe-occupancy § Details](../views/pipe-occupancy.md#compute-load-details) | Tabs / CSV field list (same packet) |
| 11.2.6 | Memory load analysis | [memory-topology](../views/memory-topology.md) | Edge / plate map in **Compute fill** |
| 11.2.6.1 | Memory CSV details | [memory-topology § Details](../views/memory-topology.md#memory-load-details) | Tabs / block / 查看全部 (same packet) |
| 11.2.7 | Statistical analysis | [overview-charts](../views/overview-charts.md) | Sampling.json + viz geometry in **Compute fill** |
| 11.2.8 | Kernel block timeline | [timeline](../views/timeline.md) | Sample CTEF binding in **Compute fill** |
| 11.2.8.1 | Event / Relevant details | _(stub — body below)_ | [§ Event details](#stub-event-details) |

<a id="emulate-profile"></a>

### Emulate profile (MHTML §11.2.3)

Same host file (`.npu-rep`); leaf via `manifest.json` ([PROC-8](../context/decisions/PROC.md)). Schemas: [emulate/FORMAT.md](../formats/emulate/FORMAT.md).

| § | Feature | View packet | Sept 30 |
| --- | --- | --- | --- |
| — | Timeline swimlane | [timeline](../views/timeline.md) | **in** |
| — | Thin report summary | [report-summary](../views/report-summary.md) | **out** ([DATA-47](../context/decisions/DATA.md)) |
| 11.2.3.4 / .6 | PIPE occupancy | [pipe-occupancy](../views/pipe-occupancy.md) | **in** |
| 11.2.3.1 | Architecture Diagram | [arch-diagram](../views/arch-diagram.md) | **in** (ArchDiagramMetrics→slot in **Emulate fill**; interim plated chrome) |
| — | Overview charts | [overview-charts](../views/overview-charts.md) | **hide** |
| 11.2.3.5 | Roofline | [roofline](../views/roofline.md) | **hide** |
| 11.2.3.2 | Memory Utilization Heatmap | _(reserved)_ | **out** ([DATA-49](../context/questions/DATA.md)) |
| 11.2.3.3,7–8 | AiCore / VF IPC / call stacks | _(reserved)_ | **out-of-scope** |

---

## Stub surface (Event / Relevant — no packet yet)

Only **§11.2.8.1** remains here. Hardware details and compute/memory CSV details live in view packets: [hardware-details](../views/hardware-details.md), [pipe-occupancy § Details](../views/pipe-occupancy.md#compute-load-details), [memory-topology § Details](../views/memory-topology.md#memory-load-details). Do **not** invent a new packet for Event/Relevant until Product defines the payload.

<a id="stub-event-details"></a>

### Pipeline / event details（流水中详情 / 详情）— §11.2.8.1

![Event details](./source/v930/detail-strip-raised.jpeg)

Docx table empty. Mockup layout:

| Region | Content |
| --- | --- |
| Summary | Task name, subtype/tag, Start (ns) → Duration (ns) |
| Parameters | `Code` (source paths), `Detail` (register/memory string), `Pc_addr`, `Process_bytes` |
| Relevant | Local dependency graph: Incoming → Current → Outgoing; connection level control; optional edge badge (counts/latency) |

**Interaction:** activated by clicking a timeline block (callout in mockup: 点击之后出现底部【详情】页面).

**Gap:** these detail fields are not in sample `trace.json`; require a richer event payload or side table not defined in the docx.

Open product questions: [context/questions/](../context/questions/).

---

## Mockup index

| File | Section |
| --- | --- |
| [`entry-overview.png`](./source/v930/entry.jpeg) | Entry + overall timeline chrome |
| [`npu-rep-layout.png`](./source/v930/entry.jpeg) | Container binary layout |
| [`report-stats.png`](./source/v930/report-stats-open.jpeg) | Report statistics |
| [`hardware-details.png`](./source/v930/hardware-more-detail.jpeg) | Hardware details |
| [`roofline.png`](./source/v930/report-stats-open.jpeg) | Roofline |
| [`pipe-occupancy.png`](./source/v930/compute-load.jpeg) | Pipe occupancy bars |
| [`pipe-details.png`](./source/v930/compute-load-detail.jpeg) | Pipe details list |
| [`memory-topology-annotated.png`](./source/v930/report-stats-scrolled.jpeg) | Memory topology SVG (nodes/edges) |
| [`memory-load-heatmap.png`](./source/v930/report-stats-scrolled.jpeg) | Memory load with BW / peak % |
| [`statistical-analysis.png`](./source/v930/entry.jpeg) | Cube/Vector statistical tracks |
| [`kernel-block-timeline.png`](./source/v930/entry.jpeg) | Block timeline |
| [`event-details.png`](./source/v930/detail-strip-raised.jpeg) | Event / Relevant details |
