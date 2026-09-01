# UI Overview

Written layout specification derived from design sketches in this folder. Filenames below are relative to `docs/ui/`.

For usage scenarios, static vs interactive surfaces, and cross-view sync, see **[UX_SPEC.md](UX_SPEC.md)**.

## Product chrome

Sketches place the viewer inside a VS Code–like IDE with:

- File tab: `report.ncrep` (active), sometimes beside `trace.json`
- Secondary nav: **OP算子** | **时间线** (Timeline) | **源码** | **详情** | **缓存**
- Left activity bar / explorer (host-owned in MSTT; not part of the Vue library shell)

**MVP:** implement the **Timeline** experience as the primary (and only required) view. Other secondary tabs remain in scope for Phase 2+ (see [FEATURE_MATRIX.md](FEATURE_MATRIX.md)).

Primary overview sketches: `source/v930/entry.jpeg`, `source/v930/entry.jpeg`, `source/v930/entry.jpeg`.

## Layout regions (Timeline)

```text
┌───────────────────────────────┬──────────────────┐
│  Toolbar (search, zoom, …)    │  Right analytics │
├──────────┬────────────────────┤  panel (full     │
│  Lane    │  Time axis         │  height)         │
│  gutter  │  Overview charts   │                  │
│  + util  │  Swimlane events   │                  │
├──────────┴────────────────────┴──────────────────┤
│  Bottom details (on selection) — Phase 2         │
└──────────────────────────────────────────────────┘
```

Toolbar sits **only** above the timeline (main column). StatsAside starts at the top of the right column, flush with the toolbar.

### 1. Toolbar

- Search field (event / op name)
- Zoom slider and zoom-to-fit
- Icon toggles (sketches): shortcuts help, report/stats, markers, show/hide dependency links, layer control, settings / display units

**MVP:** search + zoom (+/− / slider) + open/close right stats panel. Other icons: Phase 2+.

### 2. Time axis and overview charts

- Horizontal time ruler in milliseconds (sketches: ~0–18 ms)
- Vertical playhead / scrubber with precise timestamp (e.g. `00:06.456`)
- **统计分析**: stacked area/line charts for **Cube** (blue) and **Vector** (teal), time-aligned with the swimlane

**MVP:** time axis + zoom-linked overview charts **only when** `OverviewSeries` is present; otherwise **hide** the chart region (Product [Q5](../context/OPEN_QUESTIONS.md)). See [VIEW_DATA_REQUIREMENTS.md](../formats/VIEW_DATA_REQUIREMENTS.md).

### 3. Left lane hierarchy

Sketch target tree (**Card → category → Core → pipes**):

```text
Card0 | Card1                 ← only group header (28px)
├── 通信                      ← leaf spacer (util; no events)
├── 计算                      ← folder lane-row (chevron + util)
│   ├── Core0.Cube / Vec*     ← folder lane-row
│   │   └── ALL, SCALAR, FLOWCTRL, MTE1, CUBE, FIXP, MTE2, MTE3, CACHEMISS
│   └── …
└── 储存HBM                   ← leaf spacer (util; no events)
```

**Row chrome:** only **Card** uses process group-header chrome. Nested folders (`计算`, `CoreN.*`) are **lane-style rows** (22px + chevron + util). Pipe leaves paint events.

**Lane names:** producer / synthetic model supplies explicit nodes ([Q8](../context/OPEN_QUESTIONS.md)); viewer does not invent Card/Core hierarchy from flat `AIV0/PIPE_*` traces. Product **target** is this sketch tree ([Q4](../context/OPEN_QUESTIONS.md)); sample `out.rep` stays thin AIV pipes until a golden arrives. Playground stress presets emit the Card tree.

Reference: `source/v930/entry.jpeg`, `source/v930/hardware-more-detail.jpeg` (expanded Core2.Cube).

### 4. Swimlane surface

- Color-coded duration rectangles on each lane, vertically centered between gutter-aligned row dividers
- Labels on blocks when width allows (`DC_PRELOAD_XN_IMM`, Aten ops, …): vertically centered in the block; horizontally centered in the on-screen (clipped) event rect
- Uniform lane background for all event-sequence rows (no zebra striping); horizontal dividers continue from the left gutter across each lane
- **Pin lane (P2):** leaf-row pushpin in gutter (`source/v930/hardware-more-detail.jpeg`); pinned duplicates in sticky strip at top (events only, no dep links; cross-card pin order) — see [`INTERACTIONS.md`](INTERACTIONS.md)
- Optional faint background bands (`ProfilerStep#N`) — Phase 2 / when data exists
- Dependency curves between blocks — Phase 2 (`source/v930/entry.jpeg`)

Visual language should feel close to PyPTO swimlane (dark gutter, dense bars, idle gaps as empty space).

### 5. Right analytics panel

Modes observed in sketches:

| Mode | Sketch | Content | Phase |
|------|--------|---------|------:|
| Report statistics | `v930/report-stats-open`, `v930/compute-load`, `v930/compute-load-detail`, `v930/memory-load-detail` | Total time; PIPE bars + Cube\|Vector (MIX); compute/memory detail tabs; block + 查看全部 | M / M1 |
| Roofline (within stats aside or sibling) | `source/v930/entry.jpeg`, `source/v930/entry.jpeg` | Log-log bottleneck chart | M2 |
| Memory topology | `source/v930/memory-load-detail.jpeg`, changelog #5 | Static SVG + data-driven edge labels | M2 |
| Hardware details | `source/v930/hardware-more-detail.jpeg` | Host CPU, NPU chip, AI Core counts, HBM | Out of MVP ([Q7](../context/OPEN_QUESTIONS.md)) |
| Pipe field list | `source/v930/compute-load.jpeg`, `source/v930/compute-load-detail.jpeg` | Searchable PipeUtilization columns (filter + highlight) | M1 |
| Memory analysis | `source/v930/memory-load-detail.jpeg`, `source/v930/memory-load-detail.jpeg` | **Static SVG** + **data-driven edge labels** ([Q12](../context/OPEN_QUESTIONS.md)) | P2 |

**MVP:** Summary tiles that have clear data + PIPE bars when CSV present; **hide** anything without inputs ([VIEW_DATA_REQUIREMENTS](../formats/VIEW_DATA_REQUIREMENTS.md)). Overview charts hidden until series exist. Colors: [COLOR_TOKENS.md](COLOR_TOKENS.md).

### 6. Bottom / selection details

On event select (`source/v930/entry.jpeg`, `source/v930/entry.jpeg`):

- Op / instruction name, start → duration
- Related paths / PC (when present)
- Mini dependency graph (in / current / out) with depth filters

**MVP:** compact detail strip (name, start, duration, end) — bottom dock or right sub-panel. Full dependency UI → Phase 2.

## Theme and i18n

- Dark IDE-aligned surfaces (sketches are dark)
- Chinese labels match product mocks; host sets `locale` (`zh-CN` default, `en` twin catalog) — see [LOCALIZATION.md](LOCALIZATION.md)
- Color coding is normative — [COLOR_TOKENS.md](COLOR_TOKENS.md)

## Host vs library chrome

| Owned by host (MSTT) | Owned by library |
|----------------------|------------------|
| VS Code tab title, explorer tree | Secondary Timeline tabs (when implemented) |
| Theme CSS variables injection | Toolbar inside report |
| Opening `.rep` / `.ncrep` / Chrome Trace `.json` | All layout regions above |

Explorer annotation in `source/v930/entry.jpeg` (anomaly detection / performance tuning folders) is **host tree UX**, not part of the Vue report component.
