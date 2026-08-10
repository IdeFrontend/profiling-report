# Design asset index

Cross-layer map: **sources (v930) → component visual packs**. Pixel measures live in component `{Name}.spec.md` (Visual section) or shared [`components/VISUAL_SPEC.md`](./components/VISUAL_SPEC.md).

## Layers

| Layer | Path | Role |
|-------|------|------|
| A – sources | [`source/v930/`](./source/v930/) + [`manifest.yaml`](./source/manifest.yaml) | Full-frame dumps (append-only) |
| C – visual packs | `src/ui/{Component}/visual/` | Crops + `provenance.yaml` next to implementation |

## Source frames (`v930`)

| Id | File | Typical consumers |
|----|------|-------------------|
| `v930/entry` | [`entry.jpeg`](./source/v930/entry.jpeg) | Toolbar, overview, gutter, swimlane, cursor, axis ruler |
| `v930/report-stats-open` | [`report-stats-open.jpeg`](./source/v930/report-stats-open.jpeg) | Stats aside |
| `v930/report-stats-scrolled` | [`report-stats-scrolled.jpeg`](./source/v930/report-stats-scrolled.jpeg) | Aside scroll |
| `v930/search-highlight` | [`search-highlight.jpeg`](./source/v930/search-highlight.jpeg) | Search highlight, event tooltip |
| `v930/detail-strip-raised` | [`detail-strip-raised.jpeg`](./source/v930/detail-strip-raised.jpeg) | Detail strip |
| `v930/compute-load` | [`compute-load.jpeg`](./source/v930/compute-load.jpeg) | PIPE occupancy bars |
| `v930/compute-load-detail` | [`compute-load-detail.jpeg`](./source/v930/compute-load-detail.jpeg) | Compute detail, CSV fields |
| `v930/memory-load-detail` | [`memory-load-detail.jpeg`](./source/v930/memory-load-detail.jpeg) | Memory detail, block switcher |
| `v930/hardware-more-detail` | [`hardware-more-detail.jpeg`](./source/v930/hardware-more-detail.jpeg) | Hardware details |

## Component visual packs

| Component | Visual pack | Primary source |
|-----------|-------------|----------------|
| [`LaneGutter`](../../src/ui/LaneGutter/visual/) | expanders, util bars | `v930/entry` |
| [`TimeOverviewBar`](../../src/ui/TimeOverviewBar/visual/) | range handles | `v930/entry` |
| [`ReportToolbar`](../../src/ui/ReportToolbar/visual/) | search, zoom, actions | `v930/entry` |
| [`CursorTimestamp`](../../src/ui/CursorTimestamp/visual/) | cursor timestamp | `v930/entry` |
| [`AxisRuler`](../../src/ui/AxisRuler/visual/) | viewport ticks | `v930/entry` |
| [`StatsAside`](../../src/ui/StatsAside/visual/) | mode tabs, summary, PIPE, scroll, hardware | `v930/report-stats-*`, `v930/compute-*`, `v930/hardware-*` |
| [`DetailStrip`](../../src/ui/DetailStrip/visual/) | detail strip + context | `v930/detail-strip-raised` |
| [`CsvFieldListPanel`](../../src/ui/CsvFieldListPanel/visual/) | tabs, fields, block switcher | `v930/compute-load-detail`, `v930/memory-load-detail` |
| [`SwimlaneCanvas`](../../src/swimlane/SwimlaneCanvas/visual/) | event blocks, search highlight | `v930/entry`, `v930/search-highlight` |
| [`EventTooltip`](../../src/ui/EventTooltip/visual/) | floating tooltip | `v930/search-highlight` |
| ProfilingReport | (orchestration — no visual pack) | — |
| ReportLayout | (shell/resize — no visual pack) | — |

## Shared chrome

Axis ruler tokens and resizable-panel clamps: [`components/VISUAL_SPEC.md`](./components/VISUAL_SPEC.md).
