# Milestone 4 — Simulator Sept 30

**Target date:** **2026-09-30**

**Goal:** Open npu_emulate `.npu-rep` leaves with the same host path as compute; light up **报告统计**, **计算负载分析**, **内存负载分析**, and **CANNBot** tuning prompts from simulator-native embeds ([DATA-45](../../context/decisions/DATA.md)).

Index: [README.md](README.md) · Previous: [milestone-3.md](milestone-3.md)

## Product → surfaces

| Product ask | View / component | Emulate fill |
|-------------|------------------|--------------|
| Report statistics（报告统计） | [report-summary](../../views/report-summary.md) | Thin `KernelInfo` / `summary.json` ([DATA-47a](../../context/decisions/interim/DATA.md)); hide FLOPS/BW |
| Compute load analysis（计算负载分析） | [pipe-occupancy](../../views/pipe-occupancy.md) + PIPE 详情 | `PipesUtilization` / `PipeUtilizationHist` |
| Memory load analysis（内存负载分析） | [memory-topology](../../views/memory-topology.md) | `ArchDiagramMetrics` → `memoryTopology` ([DATA-48a](../../context/decisions/interim/DATA.md)) |
| Tuning report prompt | StatsAside CANNBot | Existing `cannbot-request` when sections mount |
| Timeline (supporting) | [timeline](../../views/timeline.md) | `PipeTrace.json` (µs) when present |

## Swimlane

| Item | Status | Notes |
|------|--------|-------|
| Emulate detection (`manifest.json`) | **Keep** | Thin profile or export catalog ([PROC-8](../../context/decisions/PROC.md)) |
| Timeline from PipeTrace | **Keep** | Absent → null swimlane; corrupt → throw |
| Overview charts | **Hide** | Gap (no Sampling) |

## Other views

| Item | Status | Notes |
|------|--------|-------|
| Thin summary cards + meta | **In** | Packer must include KernelInfo/summary for gelu-class demos |
| PIPE occupancy + CSV details | **In** | Emulate basenames only — no invent `PipeUtilization.csv` |
| Memory topology chrome | **New** | ArchDiagramMetrics → plated slots; capability `memoryDiagram` |
| CANNBot summary / compute / memory | **In** | Host opens UI; library emits payload |
| Roofline / heatmap / VF IPC / call stacks / arch diagram UI | **Out** | Phase 2 |

## Implementation tasks

1. Roadmap + FEATURE_MATRIX + COMPONENTS: document M4 Sept 30 scope (this file).
2. Specs / view packets / ADAPTERS / UX S10: flip memory topology Sept 30 to **in**; file DATA-48 / DATA-48a.
3. `topologyFromArchDiagramMetrics` + wire `adaptEmulate` (`memoryTopology`, `memoryTables`, `memoryDiagram` capability).
4. Refresh `data/emulate-sample.npu-rep` (and gelu pack when KernelInfo/PIPE can be added) for playground smoke.
5. Tests: mapper plated edges + peakPct; adapter smoke; cannbot scopes non-empty when packed.

## Packer exit criteria (demo leaf)

1. `manifest.json` (thin or export catalog)
2. `PipeTrace.json` (µs)
3. `KernelInfo.csv` and/or `summary.json`
4. `PipesUtilization.csv` and/or `PipeUtilizationHist.csv`
5. `ArchDiagramMetrics.csv`

## Potential blockers

| Blocker | Impact | Mitigation |
|---------|--------|------------|
| **DATA-47** KernelInfo attr names | Thin summary field drift | Ship DATA-47a interim |
| **DATA-48** Product slot map | Topology labels wrong vs chrome | Ship DATA-48a name map from gelu; refine when Product answers |
| Export packer omits KernelInfo / PIPE | Aside empty on raw gelu | Packer requirement; sample leaf includes them |
| **PROC-9** dedicated origin | Head still `origin=1` | Keep until Product assigns |

## Exit criteria

- Docs agree: summary + PIPE + memory topology + CANNBot **in** for emulate Sept 30
- `adaptEmulate` fills those VM areas from packed embeds; playground demo works
- Roofline / heatmap / VF IPC remain out-of-scope
- CI green for new mapper tests
