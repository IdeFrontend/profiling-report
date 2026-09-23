# Product sections → view packets

**Role:** Business-requirement § indexes (compute docx §11.2 + emulate MHTML §11.2.3) → [view packets](README.md). **Column / field / edge / slot → view-model tables live in those packets**, not here.

Container hub: [formats/README.md](../formats/README.md). Compute: [compute/FORMAT.md](../formats/compute/FORMAT.md). Emulate: [emulate/FORMAT.md](../formats/emulate/FORMAT.md). Catalog + overview: [README.md](README.md).

Input schemas: [INPUT_FORMATS.md](../formats/INPUT_FORMATS.md). Design hierarchy: [`DESIGN_INDEX.md`](../ui/DESIGN_INDEX.md). Source mockups: [`docs/ui/source/`](../ui/source/).

Design reference (docx): [HDesign mock](https://octo-g.hdesign.huawei.com/developerPreview/developer/index.html#edit&uniqueId=Cbt3Yr1Wzd6zfmVfNkJOYQ-50712&pageId=1001695).

---

## Docx § → view packet (compute)

| Docx § | Feature | View packet | Phase / notes |
| --- | --- | --- | --- |
| 11.2.2 | Entry / OP selector | _(shell — see [timeline](timeline.md))_ | Report open + OP dropdown drives all aside views |
| 11.2.3 | Report statistics | [report-summary](report-summary.md) | Field map + viz logic + DATA-33h / DATA-8 slots in **Compute fill** |
| 11.2.3.1 | Hardware details | [hardware-details](hardware-details.md) | Section/field table in **Compute fill** |
| 11.2.4 | Roofline | [roofline](roofline.md) | Tabs→fields + DATA-37 interim in **Compute fill** |
| 11.2.5 | PIPE occupancy | [pipe-occupancy](pipe-occupancy.md) | Cube / Vector column tables in **Compute fill** |
| 11.2.5.1 | Compute-load CSV details | [pipe-occupancy § Details](pipe-occupancy.md#compute-load-details) | Tabs / CSV field list (same packet) |
| 11.2.6 | Memory load analysis | [memory-topology](memory-topology.md) | Edge / plate map in **Compute fill** |
| 11.2.6.1 | Memory CSV details | [memory-topology § Details](memory-topology.md#memory-load-details) | Tabs / block / 查看全部 (same packet) |
| 11.2.7 | Statistical analysis | [overview-charts](overview-charts.md) | Sampling.json + viz geometry in **Compute fill** |
| 11.2.8 | Kernel block timeline | [timeline](timeline.md) | Sample CTEF binding in **Compute fill** |
| 11.2.8.1 | Event / Relevant details | [event-details](event-details.md) | Mockup regions + CTEF gaps in **Compute fill** |

<a id="emulate-profile"></a>

## Emulate profile (MHTML §11.2.3) → view packet

Same host file (`.npu-rep`); leaf via `manifest.json` ([PROC-8](../context/decisions/PROC.md)). Schemas: [emulate/FORMAT.md](../formats/emulate/FORMAT.md).

| § | Feature | View packet | Sept 30 |
| --- | --- | --- | --- |
| — | Timeline swimlane | [timeline](timeline.md) | **in** |
| — | Thin report summary | [report-summary](report-summary.md) | **out** ([DATA-47](../context/decisions/DATA.md)) |
| 11.2.3.4 / .6 | PIPE occupancy | [pipe-occupancy](pipe-occupancy.md) | **in** |
| 11.2.3.1 | Architecture Diagram | [arch-diagram](arch-diagram.md) | **in** (ArchDiagramMetrics→slot in **Emulate fill**; interim plated chrome) |
| — | Overview charts | [overview-charts](overview-charts.md) | **hide** |
| 11.2.3.5 | Roofline | [roofline](roofline.md) | **hide** |
| 11.2.3.2 | Memory Utilization Heatmap | _(reserved)_ | **out** ([DATA-49](../context/questions/DATA.md)) |
| 11.2.3.3,7–8 | AiCore / VF IPC / call stacks | _(reserved)_ | **out-of-scope** |

## Related

- Catalog + overview diagram + mockup index: [README.md](README.md)
- Design image hierarchy: [DESIGN_INDEX.md](../ui/DESIGN_INDEX.md)
