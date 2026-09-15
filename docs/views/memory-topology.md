# Memory topology

| | |
|--|--|
| **Id** | `memory-topology` |
| **Panel / component** | `MemoryTopologyPanel` → `src/ui/StatsAside/MemoryTopologyPanel/` |
| **Capability** | `memoryDiagram` |
| **Phase** | M2 |
| **Unification** | `gap` (emulate) |
| **Sept 30 (emulate)** | **hide** |

## Sketches

![Memory load / topology chrome](../ui/source/v930/report-stats-scrolled.jpeg)

**Component crops:** ![Memory topology](../../src/ui/StatsAside/MemoryTopologyPanel/visual/memory-topology.png) · ![Buffer links](../../src/ui/StatsAside/MemoryTopologyPanel/visual/buffer-links.png)

## Purpose

Fixed memory-path chrome with data-driven edge labels (BW / hit rate) for the selected block.

## View-model

| Field | Role | Required? |
|-------|------|-----------|
| `reportModel.memoryTopology` | Nodes + edges with labels | **Required to show** |
| capability `memoryDiagram` | Feature gate | Set when topology present |

## Hide rule

No drawable labels / L2 plate → hide diagram ([DATA-30](../context/decisions/DATA.md), PR-VM-018).

## Compute fill

| Adapted field | Embed | Columns / notes | Schema SSOT |
|---------------|-------|-----------------|-------------|
| `memoryTopology` | `Memory.csv`, `MemoryL0.csv`, `MemoryUB.csv`, `L2Cache.csv` | Edge map in [VIEW_DATA_MAPPING §11.2.6](../ui/VIEW_DATA_MAPPING.md); `buildMemoryTopology` | [METRICS](../formats/compute/METRICS_AND_TRACE.md), [compute/FORMAT](../formats/compute/FORMAT.md) |

## Emulate fill

| Adapted field | Embed | Columns / notes | Status |
|---------------|-------|-----------------|--------|
| `memoryTopology` | not `MemoryRWAccesses` (that is heatmap) | Needs aggregate BW map or ArchDiagramMetrics→slot Product map | `gap` → hide |
| `memoryHeatmap` | `MemoryRWAccesses.csv` | Different surface | `out-of-scope` Sept 30 |

## Adapter

| Profile | Entry | Notes |
|---------|-------|-------|
| compute | `buildMemoryTopology` / `firstLabelledMemoryTopology` | |
| emulate | — | No topology mapper yet |

## Related

- Spec: [MemoryTopologyPanel.spec.md](../../src/ui/StatsAside/MemoryTopologyPanel/MemoryTopologyPanel.spec.md)
- Product docx §: 11.2.6 / emulate heatmap 11.2.3.2 (not this panel)
- Catalog: [README](README.md)
