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
| Time-range measure / 度量模式 | M2 | Toolbar caliper; drag `[t0,t1]`; shaded band + Δt; local overlay until [Q22](../../context/OPEN_QUESTIONS.md). [changes.png](../../source/changes/changes.png) #1 |
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
| Timeline time-range measure (度量模式) | M2 | Replaces prior “Measure / cross-lane rulers” row. See Toolbar + [INTERACTIONS](INTERACTIONS.md). Aside sync → [Q22](../../context/OPEN_QUESTIONS.md) |

## Right panel

Delivery: **M** = timeline MVP; **M1** = [roadmap M1](../../process/roadmap/milestone-1.md) demo-data aside; **M2** = [roadmap M2](../../process/roadmap/milestone-2.md).

| Feature | Phase | Notes / sketches |
|---------|------:|------------------|
| Report summary (time, compute, BW, util) | M | **Interim:** name / type / duration (+ raw freq if present); **hide** compute / BW / avg-util until Q6 — [I-Q6a](../../context/INTERIM_DECISIONS.md), [VIEW_DATA_REQUIREMENTS](../formats/VIEW_DATA_REQUIREMENTS.md) |
| PIPE occupancy bars | M | From PipeUtilization.csv; mean non-`NA` ([I-Q6b](../../context/INTERIM_DECISIONS.md)); **hide** if missing |
| Cube \| Vector PIPE toggle (MIX only) | M1 | [changes.png](../../source/changes/changes.png) #2; non-MIX shows relevant side only |
| Compute-load detail tabs | M1 | `PipeUtilization` \| `ArithmeticUtilization` \| `ResourceConflictRatio` (#3); searchable field lists |
| Memory detail tabs + block + 查看全部 | M1 | Memory L1 / L2Cache / Memory L0 / Memory UB; block switcher [I-Q6c](../../context/INTERIM_DECISIONS.md); 查看全部 [I-Q6d](../../context/INTERIM_DECISIONS.md) (#4) |
| Roofline bottleneck chart | M2 | `general.png` / [milestone-2](../../process/roadmap/milestone-2.md) |
| Hardware info details | — | **Out of MVP** ([Q7](../../context/OPEN_QUESTIONS.md)); later when specs arrive |
| Memory topology diagram | M2 | Static SVG + **data-driven edge labels** ([Q12](../../context/OPEN_QUESTIONS.md), changelog #5) |

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
