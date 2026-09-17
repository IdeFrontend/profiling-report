# Views — consumer surface catalog

Per-surface packets: **sketches + adapted view-model + compute/emulate fill**. Profile **on-disk** schemas stay under [`../formats/`](../formats/) (`compute/`, `emulate/`). Adapter dispatch: [`../formats/ADAPTERS.md`](../formats/ADAPTERS.md).

**New packet:** copy [`_template.md`](_template.md). Heading order is fixed (Sketches before View-model).

## Catalog

| Id | File | Phase | Unification | Sept 30 | Sketch (primary) |
|----|------|-------|-------------|---------|------------------|
| `timeline` | [timeline.md](timeline.md) | M | `same-path` | **in** | `entry.jpeg` / task-* |
| `report-summary` | [report-summary.md](report-summary.md) | M | `adapt-mapper` | **in** (thin) | `report-stats-open.jpeg` |
| `pipe-occupancy` | [pipe-occupancy.md](pipe-occupancy.md) | M | `adapt-mapper` | **in** | `compute-load.jpeg` |
| `overview-charts` | [overview-charts.md](overview-charts.md) | M | `gap` | **hide** | OverviewCharts visual |
| `roofline` | [roofline.md](roofline.md) | M2 | `gap` | **hide** | RooflinePanel visual |
| `memory-topology` | [memory-topology.md](memory-topology.md) | M2 | `adapt-mapper` | compute **in**; emulate = interim chrome only | `report-stats-scrolled.jpeg` |
| `arch-diagram` | [arch-diagram.md](arch-diagram.md) | M4 | `adapt-mapper` | **in** (emulate; interim plated chrome) | (same chrome until biprof SVG) |

### Stubs (second pass)

Surfaces still described in legacy [VIEW_DATA_REQUIREMENTS](../formats/VIEW_DATA_REQUIREMENTS.md) until extracted: time axis, lane gutter, swimlane canvas, event tooltip, compute/memory CSV tabs, hardware details, measure mode, secondary tabs. Intended sketches when known: `task-hover.jpeg`, `task-measure-mode.jpeg`, `compute-load-detail.jpeg`, `memory-load-detail.jpeg`, `hardware-more-detail.jpeg`.

## SSOT rules

| Concern | Owner |
|---------|--------|
| Container / profiles / detection | [`../formats/README.md`](../formats/README.md) |
| Embed schemas | [`../formats/compute/`](../formats/compute/), [`../formats/emulate/`](../formats/emulate/) |
| Per-surface VM + fill + sketches | **this tree** |
| UX scenarios / interactions | [`../ui/UX_SPEC.md`](../ui/UX_SPEC.md), [`../ui/INTERACTIONS.md`](../ui/INTERACTIONS.md) |
| Component ACs | Co-located `src/ui/**/*.spec.md` — link here for data |

Do **not** fork hide rules by raw CSV name. Do **not** invent compute-shaped embeds from emulate tables ([DATA-45](../context/decisions/DATA.md)).

**Emulate packer checklist (embed → Sept 30 view):** [emulate/FORMAT §4.1](../formats/emulate/FORMAT.md#41-embeds-used-by-report-visualization-sept-30--m4).
