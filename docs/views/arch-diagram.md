# Architecture Diagram

| | |
|--|--|
| **Id** | `arch-diagram` |
| **Panel / component** | Interim: `MemoryTopologyPanel` → `src/ui/StatsAside/MemoryTopologyPanel/` (plated stand-in until biprof SVG) |
| **Capability** | `archDiagram` |
| **Phase** | M4 (emulate Sept 30) |
| **Unification** | `adapt-mapper` (emulate) |
| **Sept 30 (emulate)** | **in** |

## Purpose

Biprof **Architecture Diagram** (§11.2.3.1): path/unit bandwidth and related metrics from `ArchDiagramMetrics`.

Sept 30 uses the Asc Toolkit plated topology chrome as an **interim stand-in** — same `reportModel.memoryTopology` carrier, capability **`archDiagram`** (not compute `memoryDiagram` / 内存负载分析). Full biprof chrome / richer model: [DATA-49](../context/questions/DATA.md).

## View-model

| Field | Role | Required? |
|-------|------|-----------|
| `reportModel.memoryTopology` | Interim plated nodes + edges | **Required to show** stand-in |
| capability `archDiagram` | Feature gate (emulate) | Set when drawable |

## Hide rule

Nothing drawable → omit diagram ([DATA-30](../context/decisions/DATA.md)).

## Emulate fill

| Adapted field | Embed | Columns / notes | Status |
|---------------|-------|-----------------|--------|
| `memoryTopology` (carrier) | `ArchDiagramMetrics.csv` | Parameter→slot map [DATA-48a](../context/decisions/interim/DATA.md) | `adapt-mapper` |
| Heatmap | `MemoryRWAccesses.csv` | Different surface (§11.2.3.2) | **out** Sept 30 |

## Adapter

| Profile | Entry | Notes |
|---------|-------|-------|
| emulate | `topologyFromArchDiagramMetrics` in `adaptEmulate` | Capability `archDiagram` when drawable |
| compute | — | Compute uses [memory-topology](memory-topology.md) / `memoryDiagram` |

## Related

- Product: MHTML §11.2.3.1; delivery [milestone-4](../process/roadmap/milestone-4.md)
- Open: [DATA-48](../context/questions/DATA.md), [DATA-49](../context/questions/DATA.md)
- Interim chrome packet: [memory-topology](memory-topology.md)
