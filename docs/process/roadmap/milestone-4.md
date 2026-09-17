# Milestone 4 — Simulator Sept 30

**Target date:** **2026-09-30**

**Goal:** Open npu_emulate `.npu-rep` leaves with the same host path as compute; light up **报告统计**, **计算负载分析**, **Architecture Diagram** (biprof §11.2.3.1), and **CANNBot** tuning prompts from simulator-native embeds ([DATA-45](../../context/decisions/DATA.md)).

Index: [README.md](README.md) · Previous: [milestone-3.md](milestone-3.md)

## Product → surfaces

| Product ask | View / component | Emulate fill |
|-------------|------------------|--------------|
| Report statistics（报告统计） | [report-summary](../../views/report-summary.md) | Thin `KernelInfo` ([DATA-47a](../../context/decisions/interim/DATA.md)); hide FLOPS/BW |
| Compute load analysis（计算负载分析） | [pipe-occupancy](../../views/pipe-occupancy.md) + PIPE 详情 | `PipesUtilization` / `PipeUtilizationHist` |
| Architecture Diagram（架构图 / biprof 11.2.3.1） | [arch-diagram](../../views/arch-diagram.md) (interim chrome: [memory-topology](../../views/memory-topology.md)) | `ArchDiagramMetrics` → plated slots via `memoryTopology` VM ([DATA-48a](../../context/decisions/interim/DATA.md)); capability `archDiagram` |
| Tuning report prompt | StatsAside CANNBot | Existing `cannbot-request` when sections mount |
| Timeline (supporting) | [timeline](../../views/timeline.md) | `PipeTrace.json` (µs) when present |

**Not Sept 30:** Memory Utilization Heatmap (`MemoryRWAccesses`), compute-style 内存负载分析 naming for emulate, dedicated biprof arch SVG ([DATA-49](../../context/questions/DATA.md)).

## Swimlane

| Item | Status | Notes |
|------|--------|-------|
| Emulate detection (`manifest.json`) | **Keep** | Thin profile or export catalog ([PROC-8](../../context/decisions/PROC.md)) |
| Timeline from PipeTrace | **Keep** | Absent → null swimlane; corrupt → throw |
| Overview charts | **Hide** | Gap (no Sampling) |

## Other views

| Item | Status | Notes |
|------|--------|-------|
| Thin summary cards + meta | **In** | Packer must include KernelInfo for gelu-class demos |
| PIPE occupancy + CSV details | **In** | Emulate basenames only — no invent `PipeUtilization.csv` |
| Architecture Diagram | **In** | ArchDiagramMetrics → interim plated chrome; capability `archDiagram` |
| CANNBot summary / compute / memory | **In** | Host opens UI; library emits payload |
| Heatmap / roofline / VF IPC / call stacks / full ArchDiagramModel | **Out** | Phase 2 ([DATA-49](../../context/questions/DATA.md)) |

## Implementation tasks

1. Roadmap + FEATURE_MATRIX + COMPONENTS: document M4 Sept 30 scope (this file).
2. Specs / view packets / ADAPTERS / UX S10: Architecture Diagram **in**; heatmap **out**; DATA-48 / DATA-48a / DATA-49.
3. `topologyFromArchDiagramMetrics` + wire `adaptEmulate` (`memoryTopology` carrier, `archDiagram` capability).
4. Refresh `data/emulate-sample.npu-rep` for playground smoke.
5. Tests: mapper + `archDiagram` capability; cannbot scopes when packed.

## Packer exit criteria (demo leaf)

Normative embed → view table: [emulate/FORMAT §4.1](../../formats/emulate/FORMAT.md#41-embeds-used-by-report-visualization-sept-30--m4).

1. `manifest.json` (thin or export catalog)
2. `PipeTrace.json` (µs)
3. `KernelInfo.csv`
4. `PipesUtilization.csv` and/or `PipeUtilizationHist.csv`
5. `ArchDiagramMetrics.csv`

## Potential blockers

| Blocker | Impact | Mitigation |
|---------|--------|------------|
| **DATA-47** KernelInfo attr names | Thin summary field drift | Ship DATA-47a interim |
| **DATA-48** Product slot map | Arch diagram labels wrong vs chrome | Ship DATA-48a name map from gelu; refine when Product answers |
| **DATA-49** dedicated arch model/chrome | Lossy projection until biprof SVG | Interim topology chrome; escalate when Product provides chrome |
| Export packer must include KernelInfo / PIPE for aside | gelu 2026-09-17 packs them; keep packing on future dumps | Packer requirement; sample leaf also includes them |
| **PROC-9** dedicated origin | Head still `origin=1` | Keep until Product assigns |

## Exit criteria

- Docs agree: summary + PIPE + **Architecture Diagram** + CANNBot **in**; heatmap **out**
- `adaptEmulate` fills those VM areas from packed embeds; playground demo works
- Roofline / heatmap / VF IPC remain out-of-scope
- CI green for mapper tests
