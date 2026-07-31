# UI Overview

Written layout specification derived from design sketches in this folder. Filenames below are relative to `docs/specs/ui/`.

For usage scenarios, static vs interactive surfaces, and cross-view sync, see **[UX_SPEC.md](UX_SPEC.md)**.

## Product chrome

Sketches place the viewer inside a VS Code–like IDE with:

- File tab: `report.ncrep` (active), sometimes beside `trace.json`
- Secondary nav: **OP算子** | **时间线** (Timeline) | **源码** | **详情** | **缓存**
- Left activity bar / explorer (host-owned in MSTT; not part of the Vue library shell)

**MVP:** implement the **Timeline** experience as the primary (and only required) view. Other secondary tabs remain in scope for Phase 2+ (see [FEATURE_MATRIX.md](FEATURE_MATRIX.md)).

Primary overview sketches: `general.png`, `with_sidebar.png`, `swimlane.png`.

## Layout regions (Timeline)

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  Secondary tabs │ Toolbar (search, zoom, toggles)                        │
├────────────┬─────────────────────────────────────────────┬───────────────┤
│            │  Time axis + playhead                       │               │
│  Lane      │  Cube / Vector overview charts              │  Right        │
│  hierarchy │─────────────────────────────────────────────│  analytics    │
│  + util %  │  Swimlane event blocks                      │  panel        │
│            │                                             │               │
├────────────┴─────────────────────────────────────────────┴───────────────┤
│  Bottom details (on selection) — Phase 2 layout; MVP may use side strip  │
└──────────────────────────────────────────────────────────────────────────┘
```

### 1. Toolbar

- Search field (event / op name)
- Zoom slider and zoom-to-fit
- Icon toggles (sketches): shortcuts help, report/stats, markers, show/hide dependency links, layer control, settings / display units

**MVP:** search + zoom (+/− / slider) + open/close right stats panel. Other icons: Phase 2+.

### 2. Time axis and overview charts

- Horizontal time ruler in milliseconds (sketches: ~0–18 ms)
- Vertical playhead / scrubber with precise timestamp (e.g. `00:06.456`)
- **统计分析**: stacked area/line charts for **Cube** (blue) and **Vector** (teal), time-aligned with the swimlane

**MVP:** time axis + zoom-linked overview charts when `OverviewSeries` is present; otherwise **hide** the chart region (no empty chart chrome). See [UX_SPEC](UX_SPEC.md) / [Q5](../../context/OPEN_QUESTIONS.md).

### 3. Left lane hierarchy

Under a **Kernel** (or process) group:

- Core entries: `CoreN.Cube`, `CoreN.Vec0`, `CoreN.Vec1`, …
- Expandable pipe children: `SCALAR`, `FLOWCTRL`, `MTE1`, `CUBE`, `FIXP`, `MTE2`, `MTE3`, `CACHEMISS`
- Per-row utilization % + mini bar (color encodes load; low util may use grey/red accents in mocks)

When the trace only exposes AIV pipe lanes (sample `.rep`), render the available hierarchy without inventing cores.

Reference: `swimlane.png`, `sidebar_details.png` (expanded Core2.Cube).

### 4. Swimlane surface

- Color-coded duration rectangles on each lane
- Labels on blocks when width allows (`DC_PRELOAD_XN_IMM`, Aten ops, …)
- Optional faint background bands (`ProfilerStep#N`) — Phase 2 / when data exists
- Dependency curves between blocks — Phase 2 (`swimlane_selection.png`)

Visual language should feel close to PyPTO swimlane (dark gutter, dense bars, idle gaps as empty space).

### 5. Right analytics panel

Modes observed in sketches:

| Mode | Sketch | Content | Phase |
|------|--------|---------|------:|
| Report statistics | `general.png`, `with_sidebar.png` | Total time, compute, I/O BW, avg core util; PIPE bars | M |
| Roofline (within stats aside or sibling) | `general.png`, `with_sidebar.png` | Log-log bottleneck chart | P2 |
| Hardware details | `sidebar_details.png` | Host CPU, NPU chip, AI Core counts, HBM | P2 |
| Pipe field list | `pipe_utilization.png`, `pipe_details.png` | Searchable PipeUtilization columns | P2 |
| Memory analysis | `memory_chart.png`, `memory_details.png` | Topology diagram + Memory.csv fields | P2 |

**MVP:** Report statistics summary + PIPE occupancy bars only. Roofline, hardware, memory diagram, and raw field lists → Phase 2+ (see [UX_SPEC.md](UX_SPEC.md), [FEATURE_MATRIX.md](FEATURE_MATRIX.md)).

### 6. Bottom / selection details

On event select (`swimlane_selection.png`, `swimlane_selection2.png`):

- Op / instruction name, start → duration
- Related paths / PC (when present)
- Mini dependency graph (in / current / out) with depth filters

**MVP:** compact detail strip (name, start, duration, end) — bottom dock or right sub-panel. Full dependency UI → Phase 2.

## Theme and i18n

- Dark IDE-aligned surfaces (sketches are dark)
- Chinese labels match product mocks; library should expose message keys for EN/ZH
- Color coding should stay consistent across lane bars, PIPE chart, and overview series (Cube blue, Vector teal, MTE warm tones, etc.)

## Host vs library chrome

| Owned by host (MSTT) | Owned by library |
|----------------------|------------------|
| VS Code tab title, explorer tree | Secondary Timeline tabs (when implemented) |
| Theme CSS variables injection | Toolbar inside report |
| Opening `.rep` | All layout regions above |

Explorer annotation in `swimlane.png` (anomaly detection / performance tuning folders) is **host tree UX**, not part of the Vue report component.
