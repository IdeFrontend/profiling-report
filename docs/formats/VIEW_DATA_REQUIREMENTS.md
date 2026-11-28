# View and Chart Data Requirements

**Moved to per-view packets.** Catalog and SSOT rules: [`../views/README.md`](../views/README.md). Template: [`../views/_template.md`](../views/_template.md).

Extracted surfaces (sketches + VM + compute/emulate fill):

| Id | Packet |
|----|--------|
| `timeline` | [../views/timeline.md](../views/timeline.md) |
| `event-details` | [../views/event-details.md](../views/event-details.md) |
| `report-summary` | [../views/report-summary.md](../views/report-summary.md) |
| `hardware-details` | [../views/hardware-details.md](../views/hardware-details.md) |
| `pipe-occupancy` | [../views/pipe-occupancy.md](../views/pipe-occupancy.md) |
| `overview-charts` | [../views/overview-charts.md](../views/overview-charts.md) |
| `roofline` | [../views/roofline.md](../views/roofline.md) |
| `memory-topology` | [../views/memory-topology.md](../views/memory-topology.md) |
| `performance-hints` | [../views/performance-hints.md](../views/performance-hints.md) |
| `source` | [../views/source.md](../views/source.md) — on-disk embeds [compute/FORMAT.md](compute/FORMAT.md) |

**Still on this page until a second extract pass** (same hide policy [DATA-30](../context/decisions/DATA.md)): time axis, lane gutter, swimlane canvas, measure mode — see historical sections below or [views README stubs](../views/README.md). (Hardware, CSV tabs, event/Relevant details, and Source are in view packets.)

Formats hub: [`README.md`](README.md). Adapters: [`ADAPTERS.md`](ADAPTERS.md). Product § indexes: [`../views/product-sections.md`](../views/product-sections.md); catalog: [`../views/README.md`](../views/README.md).

---

## Global open policy (DATA-30)

1. Open Timeline with **minimal** data: usable `SwimlaneModel` (typically from `PipeTrace.json` / `trace.json` or standalone Chrome Trace `.json`).
2. Each panel independently: missing inputs → **hide** (no empty chrome; no hard error for optional analytics).
3. Hard error only when the **source cannot be parsed**.

---

## Surfaces (legacy — pending extract)

### 2. Time axis + playhead (`TimeAxis`)

| Input | Requirement |
|-------|-------------|
| `SwimlaneModel.minTime` / `maxTime` (ns) | **Required** |
| `SwimlaneViewState` visible window | **Required** (defaults to full range) |
| Display unit preference | **Optional** — `TimeDisplayMode`; emulate may omit cycles mode |

### 4. Lane gutter (`LaneGutter`)

| Input | Requirement |
|-------|-------------|
| `SwimProcess` / `SwimThread` names | **Required** |
| Hierarchy Card → … → pipes | Producer- or stress-defined ([DATA-35](../context/decisions/DATA.md)) |
| Gutter metric / bars | **Optional** — see [gutter-metrics.spec.md](../../specs/core/gutter-metrics.spec.md) |

### 5. Swimlane canvas (`SwimlaneCanvas` / events)

| Input | Requirement |
|-------|-------------|
| `SwimEvent` | **Required** (empty trace → empty lanes) |
| `dependencies` | **Optional** — P2 |

### 13. Timeline time-range measure — M2

See FEATURE_MATRIX / UX_SPEC; sketch `task-measure-mode.jpeg`.

### 15. Secondary tabs — Source (UI-37)

**Moved** to [../views/source.md](../views/source.md). On-disk embeds: [`objdump.txt.md`](compute/objdump.txt.md), [`symbolizer.json.md`](compute/symbolizer.json.md), [`summary.db.md`](compute/summary.db.md) — index [compute/FORMAT.md](compute/FORMAT.md).

| Input | Requirement |
|-------|-------------|
| Compute multi-file ([`objdump.txt`](compute/objdump.txt.md) + [`symbolizer.json`](compute/symbolizer.json.md) / [`summary.db`](compute/summary.db.md) + source [`.asc`](compute/symbolizer.json.md#source-text)) | → `reportModel.sourceCorrelation` with `mock: false` ([DATA-52](../context/questions/DATA.md) partial) |
| Emulate ELF ([`SourceInstructions.csv`](emulate/SourceInstructions.csv.md) / [`AsmMetrics.csv`](emulate/AsmMetrics.csv.md) + optional SourceFiles/Lines/DebugInfo/SourceLineMetrics) | → `mock: false` when gate passes ([DATA-53](../context/decisions/DATA.md)); assembly-only OK; sparse source may set `lineCount` with sparse `lines` ([DATA-53d](../context/decisions/interim/DATA.md#data-53d)) |
| `SourceCorrelation.json` (or Product-named embed) | Reserved; schema still TBD → ignored until Product locks it |
| Missing embeds on report packs | Omit `sourceCorrelation` and `'sourceTab'`; 源码 control is absent ([UI-37](../context/decisions/UI.md)) |
| Chrome Trace–only | Omit `sourceCorrelation` and `'sourceTab'` |
| SASS listing columns | `#` (UI) · Address · Assembly · **metric columns from the model** (compute: Instructions Executed · Sampling Stall · Warp Occupancy; emulate MVP per [DATA-53](../context/decisions/DATA.md)) — Address/Assembly are table cells (no Sudu) |
| 详情 / 缓存 | Not in the chrome ([UI-37](../context/decisions/UI.md)) |

Switch point: `adaptSourceCorrelation(payloads)` — compute multi-file **in**; emulate ELF **in** ([DATA-53](../context/decisions/DATA.md)); single JSON still open ([DATA-52](../context/questions/DATA.md)). Hosts must `await ensurePcSamplingSql()` (or rely on ProfilingReport’s load path) before adapting packs that embed `summary.db`. Dock / Redo Resolve / heat tint: [UI-57](../context/questions/UI.md)–[UI-59](../context/questions/UI.md).

### Block scope matrix

See [pipe-occupancy](../views/pipe-occupancy.md) and [memory-topology](../views/memory-topology.md); full matrix historically DATA-28/29/33b/33c.

## Standalone `.json` (PROC-3)

Chrome Trace → timeline only; empty `ReportViewModel` → aside hidden.
