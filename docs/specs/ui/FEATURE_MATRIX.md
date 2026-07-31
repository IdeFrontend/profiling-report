# Feature Matrix

All sketch-visible features remain **in product scope**. MVP is the first shippable slice; Phase 2+ items are deferred but specified.

Legend: **M** = MVP must-have · **P2** = Phase 2+ · **H** = host (MSTT) responsibility

## Shell and navigation

| Feature | Phase | Notes / sketches |
|---------|------:|------------------|
| Open `.rep` / `.ncrep` in panel | H / M | Host opens; library renders |
| Open Chrome Trace `.json` in panel | H / M | Same library; aside hidden without CSVs ([Q15](../../context/OPEN_QUESTIONS.md)) |
| Timeline secondary tab | M | Primary view |
| OP算子 / 源码 / 详情 / 缓存 tabs | P2 | msinsight-like parity |
| Host explorer / performance tree | H | `swimlane.png` left rail |
| Keep Insight for `.bin` | H | See formats comparison |

## Toolbar

| Feature | Phase | Notes / sketches |
|---------|------:|------------------|
| Search events | M | Fuzzy optional later |
| Zoom slider / zoom to fit | M | |
| Keyboard shortcut help | P2 | |
| Toggle stats / report panel | M | |
| Timeline markers | P2 | `with_sidebar.png` annotations |
| Show/hide dependency links | P2 | |
| Layer / display control (clock cycles, units) | P2 | `sidebar_details.png` “显示控制” |
| Settings | P2 | |

## Swimlane

| Feature | Phase | Notes / sketches |
|---------|------:|------------------|
| Time axis + playhead | M | Times in **ns**; display unit **configurable** ([Q14](../../context/OPEN_QUESTIONS.md)); axis default **ms** |
| Cube / Vector overview charts | M | **Hide** until `OverviewSeries` ([Q5](../../context/OPEN_QUESTIONS.md)) |
| Hierarchical lane gutter + util bars | M | Producer **fixed** lane names ([Q8](../../context/OPEN_QUESTIONS.md)); util bars optional |
| Colored event rectangles | M | Normative colors [COLOR_TOKENS](COLOR_TOKENS.md) |
| Event labels when wide enough | M | |
| Zoom / pan (wheel, drag, slider) | M | See [INTERACTIONS](INTERACTIONS.md); W/S/A/D → P2 ([PACKAGING_SUGGESTIONS](../../context/PACKAGING_SUGGESTIONS.md)) |
| ProfilerStep background bands | P2 | Needs data |
| Dependency bezier links | P2 | `swimlane_selection.png` |
| Pin lane / context menu | P2 | `swimlane_context_menu.png` |
| Multi-select time slice summary | P2 | `swimlane_multiselect.png` |

## Interactions (see also INTERACTIONS.md)

| Feature | Phase | Notes / sketches |
|---------|------:|------------------|
| Hover tooltip (name, start, dur, end) | M | `swimlane_hover.png` |
| Single select → detail | M | |
| Multi-select | P2 | |
| Context menu | P2 | |
| Measure / cross-lane rulers | P2 | PyPTO parity optional |

## Right panel

| Feature | Phase | Notes / sketches |
|---------|------:|------------------|
| Report summary (time, compute, BW, util) | M | **Interim:** name / type / duration (+ raw freq if present); **hide** compute / BW / avg-util until Q6 — [I-Q6a](../../context/INTERIM_DECISIONS.md), [VIEW_DATA_REQUIREMENTS](../formats/VIEW_DATA_REQUIREMENTS.md) |
| PIPE occupancy bars | M | From PipeUtilization.csv; mean non-`NA` ([I-Q6b](../../context/INTERIM_DECISIONS.md)); **hide** if missing |
| Roofline bottleneck chart | P2 | `general.png` |
| Hardware info details | — | **Out of MVP** ([Q7](../../context/OPEN_QUESTIONS.md)); later when specs arrive |
| Memory topology diagram | P2 | Static SVG + **data-driven labels** ([Q12](../../context/OPEN_QUESTIONS.md)) |
| Pipe raw field list (searchable) | P2 | `pipe_utilization.png`, `pipe_details.png` — MVP keeps bars only ([UX S5](UX_SPEC.md)) |
| Memory raw field list | P2 | `memory_details.png` |
| L2 / cache analytics | P2 | Cache tab + L2Cache.csv |

## Selection details

| Feature | Phase | Notes / sketches |
|---------|------:|------------------|
| Name + start/duration/end | M | |
| Source paths / PC address | P2 | |
| Dependency mini-graph + depth filters | P2 | `swimlane_selection.png` |

## Non-functional

| Feature | Phase | Notes |
|---------|------:|-------|
| Vue 3 library packaging | M | See architecture |
| Dark theme + CSS variables | M | |
| i18n hooks (EN/ZH) | M | Chinese copy OK initially |
| Dense-trace WebGL path | P2 | Recommended; see research |
| Canvas 2D interim renderer | M | Acceptable if traces stay small |
| Visual regression fixtures | P2 | First functional fixture: `data/out.rep` ([I-Q4](../../context/INTERIM_DECISIONS.md)); sketch-faithful golden later |

## Explicitly out of MVP (still may be later)

- Hardware details aside ([Q7](../../context/OPEN_QUESTIONS.md)) until product specs arrive
- PyPTO AICPU E2E mode, Mix/wrap, three-column compute-graph jumps
- MindStudio system/cluster/serving modes
- Replacing Insight for `.bin`
