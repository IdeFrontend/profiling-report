# Milestone 4 — Simulator Sept 30

**Target date:** **2026-09-30**

**Goal:** Open npu_emulate `.npu-rep` leaves with the same host path as compute; light up **计算负载分析**, **Memory load analysis**, **性能提示** (performance hints), and **CANNBot** (compute/memory) from simulator-native embeds ([DATA-45](../../context/decisions/interim/DATA.md#data-45)). Summary cards / meta header are **out** ([DATA-47](../../context/decisions/DATA.md)).

Index: [README.md](README.md) · Previous: [milestone-3.md](milestone-3.md)

## Product → surfaces

| Product ask | View / component | Emulate fill |
|-------------|------------------|--------------|
| Report statistics（报告统计） cards + meta | [report-summary](../../views/report-summary.md) | **Out** ([DATA-47](../../context/decisions/DATA.md)) |
| Compute load analysis（计算负载分析） | [pipe-occupancy](../../views/pipe-occupancy.md) + PIPE 详情 | `PipesUtilization` / `PipeUtilizationHist` |
| Architecture Diagram data → **Memory load analysis** UI（架构图 metrics / biprof 11.2.3.1） | [memory-topology](../../views/memory-topology.md) | `ArchDiagramMetrics` → plated slots via `memoryTopology` VM ([DATA-48a](../../context/decisions/interim/DATA.md)); capability `archDiagram`; **UI title** = 内存负载分析 (same as compute) |
| Tuning report prompt | StatsAside CANNBot | compute / memory scopes when sections mount |
| Performance hints（性能提示） | [performance-hints](../../views/performance-hints.md) | **Planned.** Bottom dock table: hint message, source line, instruction address. CSVs: `HintMessages`, `HintTypes`, `InstructionHints`, `KernelHints`, `SourceLineHints` |
| Timeline (supporting) | [timeline](../../views/timeline.md) | `PipeTrace.json` (µs) when present |

**Not Sept 30:** Memory Utilization Heatmap (`MemoryRWAccesses`), dedicated biprof arch SVG ([DATA-49](../../context/questions/DATA.md)), summary cards / pid·opType·Blocks·更多 ([DATA-47](../../context/decisions/DATA.md)).

## Swimlane

| Item | Status | Notes |
|------|--------|-------|
| Emulate detection (`manifest.json`) | **Keep** | Thin profile or export catalog ([PROC-8](../../context/decisions/PROC.md)) |
| Timeline from PipeTrace | **Keep** | Absent → null swimlane; corrupt → throw |
| Overview charts | **Hide** | Gap (no Sampling) |

## Other views

| Item | Status | Notes |
|------|--------|-------|
| Thin summary cards + meta / 更多 | **Out** | [DATA-47](../../context/decisions/DATA.md) |
| PIPE occupancy + CSV details | **In** | Emulate basenames only — no invent `PipeUtilization.csv` |
| Architecture Diagram | **In** | ArchDiagramMetrics → interim plated chrome; capability `archDiagram`; UI title **内存负载分析** |
| CANNBot compute / memory | **In** | Host opens UI; library emits payload; summary-scope icon omitted with meta |
| Performance hints（性能提示） | **Planned** | Sketch [`v930-sim/performance-hints`](../../ui/source/v930-sim/performance-hints.jpeg); gelu packs the hint CSVs; view not built |
| Heatmap / roofline / VF IPC / call stacks / full ArchDiagramModel | **Out** | Phase 2 ([DATA-49](../../context/questions/DATA.md)) |

## Implementation tasks

1. Roadmap + FEATURE_MATRIX + COMPONENTS: document M4 Sept 30 scope (this file).
2. Specs / view packets / ADAPTERS / UX S10: Architecture Diagram **in**; heatmap **out**; DATA-48 / DATA-48a / DATA-49.
3. `topologyFromArchDiagramMetrics` + wire `adaptEmulate` (`memoryTopology` carrier, `archDiagram` capability).
4. Keep `data/gelu.npu-rep` current for playground / unit smoke (sole emulate fixture).
5. Tests: mapper + `archDiagram` capability; cannbot scopes when packed.
6. Performance hints dock: join hint CSVs into the 性能提示 table ([performance-hints](../../views/performance-hints.md)).

## Packer exit criteria (demo leaf)

Normative embed → view table: [emulate/FORMAT §4.1](../../formats/emulate/FORMAT.md#41-embeds-used-by-report-visualization-sept-30--m4).

1. `manifest.json` (thin or export catalog)
2. `PipeTrace.json` (µs) **or** native `core_*_tracing_report_*.json`
3. `PipesUtilization.csv` and/or `PipeUtilizationHist.csv`
4. `ArchDiagramMetrics.csv`
5. Performance-hint CSVs when the 性能提示 view is expected: `HintMessages.csv`, `HintTypes.csv`, `InstructionHints.csv`, `KernelHints.csv`, `SourceLineHints.csv`

## Potential blockers

| Blocker | Impact | Mitigation |
|---------|--------|------------|
| **DATA-48** Product slot map | Arch diagram labels wrong vs chrome | Ship DATA-48a name map from gelu; refine when Product answers |
| **DATA-49** dedicated arch model/chrome | Lossy projection until biprof SVG | Interim topology chrome; escalate when Product provides chrome |
| Export packer must include PIPE / ArchDiagram for aside | gelu packs them; keep packing on future dumps | Packer requirement; sample leaf also includes them |
| Source line on hints | `SourceLineHints.SourceLineId` needs `SourceLines` for a line number; gelu leaves `SourceLines` empty | Show the id or omit the line until ELF/`SourceLines` is packed |
| **PROC-9** dedicated origin | Head still `origin=1` | Keep until Product assigns |

## Exit criteria

- Docs agree: PIPE + **Memory load analysis** + CANNBot (compute/memory) **in**; **性能提示** planned; summary chrome + heatmap **out**
- `adaptEmulate` fills those VM areas from packed embeds; playground demo works
