# Feature Matrix

All sketch-visible features remain **in product scope**. MVP is the first shippable slice; Phase 2+ items are deferred but specified.

Legend: **M** = MVP must-have · **P2** = Phase 2+ · **H** = host (MSTT) responsibility

## Shell and navigation

| Feature | Phase | Notes / sketches |
|---------|------:|------------------|
| Open `.rep` / `.ncrep` in panel | H / M | Host opens; library renders |
| Open Chrome Trace `.json` in panel | H / M | Same library; aside hidden without CSVs ([Q15](../context/OPEN_QUESTIONS.md)) |
| Timeline secondary tab | M | Primary view |
| OP算子 / 源码 / 详情 / 缓存 tabs | P2 | msinsight-like parity |
| Host explorer / performance tree | H | `source/v930/entry.jpeg` left rail |
| Keep Insight for `.bin` | H | See formats comparison |

## Toolbar

| Feature | Phase | Notes / sketches |
|---------|------:|------------------|
| Search events | M | Fuzzy optional later |
| Zoom slider / zoom to fit | M | |
| Keyboard shortcut help | P2 | |
| Toggle stats / report panel | M | |
| Time-range measure / 度量模式 | M2 | Toolbar caliper; drag `[t0,t1]`; shaded band + Δt; **local overlay only** — does not recompute the aside. Sketch: [`v930/task-measure-mode`](./source/v930/task-measure-mode.jpeg) |
| Timeline markers | P2 | `source/v930/entry.jpeg` annotations |
| Show/hide dependency links | P2 | |
| Task display unit (ms/µs/ns) | M | Via toolbar **layers** → **显示控制** popover ([`v930/hardware-more-detail`](./source/v930/hardware-more-detail.jpeg)); not an inline toolbar select. Cycle mode deferred ([I-Q14](../context/INTERIM_DECISIONS.md)) |
| Layer / display control (extra options, clock cycles) | P2 | Same popover surface; more options later |
| Settings | P2 | |

## Swimlane

| Feature | Phase | Notes / sketches |
|---------|------:|------------------|
| Time axis + playhead | M | Times in **ns**; display unit **configurable** ([Q14](../context/OPEN_QUESTIONS.md)); axis default **ms** |
| Cube / Vector overview charts | M | **Hide** until `OverviewSeries` ([Q5](../context/OPEN_QUESTIONS.md)) |
| Hierarchical lane gutter + util bars | M | Card → 通信/计算/储存HBM → Core → pipes; **only Card** is group header; nested folders = lane-style expanders + util. Producer/stress **fixed** names ([Q8](../context/OPEN_QUESTIONS.md)); flat CTEF still valid |
| Uniform event-sequence lane background + horizontal row dividers | M | No zebra striping; gutter↔timeline continuous `#3a3a3a` lines ([UI_OVERVIEW](UI_OVERVIEW.md)) |
| Colored event rectangles | M | Normative colors [COLOR_TOKENS](COLOR_TOKENS.md) |
| Event labels when wide enough | M | Vertically centered in block; horizontally centered in visible (clipped) event rect |
| Adjacent-event gap measure (hover) | M | Default-mode hover in the free gap between adjacent events shows a transient, non-interactive Δt overlay (border sticks + arrow); does not change selection or window |
| Zoom / pan (wheel, drag, slider) | M | See [INTERACTIONS](INTERACTIONS.md); W/S/A/D → P2 ([PACKAGING_SUGGESTIONS](../context/PACKAGING_SUGGESTIONS.md)) |

| ProfilerStep background bands | P2 | Needs data |
| Dependency bezier links | P2 | `source/v930/entry.jpeg` |
| Pin lane / context menu | P2 | `source/v930/entry.jpeg` |
| Multi-select time slice summary | P2 | `source/v930/entry.jpeg` |

## Interactions (see also INTERACTIONS.md)

| Feature | Phase | Notes / sketches |
|---------|------:|------------------|
| Hover tooltip (name, start, dur, end) | M | `source/v930/task-hover.jpeg` |
| Single select → detail | M | |
| Multi-select | P2 | |
| Context menu | P2 | |
| Timeline time-range measure (度量模式) | M2 | Replaces prior “Measure / cross-lane rulers” row. See Toolbar + [INTERACTIONS](INTERACTIONS.md). Aside is not recomputed for the measured range. |

## Right panel

Delivery: **M** = timeline MVP; **M1** = [roadmap M1](../process/roadmap/milestone-1.md) demo-data aside; **M2** = [roadmap M2](../process/roadmap/milestone-2.md).

| Feature | Phase | Notes / sketches |
|---------|------:|------------------|
| Report summary (time, compute, BW, util) | M | **Interim:** duration [I-Q6a](../context/INTERIM_DECISIONS.md); **I/O BW cards** [I-Q6g](../context/INTERIM_DECISIONS.md); compute / avg-util **N/A placeholders** until Q6 — [VIEW_DATA_REQUIREMENTS](../formats/VIEW_DATA_REQUIREMENTS.md) |
| Aside shell (title, close, meta, 更多) | M | Close hides aside; meta hide-if-missing; 更多 opens hardware overlay (I-Q7a) — [StatsAside](../../src/ui/StatsAside/StatsAside.spec.md), [INTERACTIONS](INTERACTIONS.md) |
| PIPE occupancy bars | M | From PipeUtilization.csv; mean non-`NA` ([I-Q6b](../context/INTERIM_DECISIONS.md)); **hide** if missing |
| Cube \| Vector PIPE toggle (MIX only) | M1 | [`v930/compute-load`](./source/v930/compute-load.jpeg); non-MIX shows relevant side only |
| Compute-load detail tabs | M1 | `PipeUtilization` \| `ArithmeticUtilization` \| `ResourceConflictRatio` (#3); searchable field lists |
| Memory detail tabs + block + 查看全部 | M1 | Memory L1 / L2Cache / Memory L0 / Memory UB; block switcher [I-Q6c](../context/INTERIM_DECISIONS.md); 查看全部 [I-Q6d](../context/INTERIM_DECISIONS.md) (#4) |
| Roofline bottleneck chart | M2 | `source/v930/report-stats-open.jpeg` / [milestone-2](../process/roadmap/milestone-2.md) |
| Hardware info details | M1 | **Source confirmed:** `HardwareInfo.jsonl`; OpBasicInfo fallback ([I-Q7a](../context/INTERIM_DECISIONS.md)). Hide overlay if both absent |
| Memory topology diagram | M2 | Static SVG + **data-driven edge labels** ([Q12](../context/OPEN_QUESTIONS.md), changelog #5) |

## Selection details

| Feature | Phase | Notes / sketches |
|---------|------:|------------------|
| Name + start/duration/end | M | |
| Source paths / PC address | P2 | |
| Dependency mini-graph + depth filters | P2 | `source/v930/entry.jpeg` |

## Non-functional

| Feature | Phase | Notes |
|---------|------:|-------|
| Vue 3 library packaging | M | See architecture |
| Dark theme + CSS variables | M | |
| i18n hooks (EN/ZH) | M | Chinese copy OK initially |
| Dense-trace WebGL path | M | Hybrid implemented (`WebGlSwimlaneRenderer` + Canvas overlay); Canvas fallback when WebGL2 unavailable — [SWIMLANE_IMPLEMENTATIONS](../archive/research/SWIMLANE_IMPLEMENTATIONS.md) |
| Canvas 2D renderer | M | Fallback / forced via `preferRenderer: 'canvas'` |
| Visual regression fixtures | P2 | First functional fixture: `data/out.rep` ([I-Q4](../context/INTERIM_DECISIONS.md)); sketch-faithful golden later |

## Explicitly out of MVP (still may be later)

- PyPTO AICPU E2E mode, Mix/wrap, three-column compute-graph jumps
- MindStudio system/cluster/serving modes
- Replacing Insight for `.bin`
