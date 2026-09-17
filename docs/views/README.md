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
| `memory-topology` | [memory-topology.md](memory-topology.md) | M2 / M4 | `adapt-mapper` | **in** | `report-stats-scrolled.jpeg` |

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
