# View and Chart Data Requirements

**Moved to per-view packets.** Catalog and SSOT rules: [`../views/README.md`](../views/README.md). Template: [`../views/_template.md`](../views/_template.md).

Extracted surfaces (sketches + VM + compute/emulate fill):

| Id | Packet |
|----|--------|
| `timeline` | [../views/timeline.md](../views/timeline.md) |
| `report-summary` | [../views/report-summary.md](../views/report-summary.md) |
| `pipe-occupancy` | [../views/pipe-occupancy.md](../views/pipe-occupancy.md) |
| `overview-charts` | [../views/overview-charts.md](../views/overview-charts.md) |
| `roofline` | [../views/roofline.md](../views/roofline.md) |
| `memory-topology` | [../views/memory-topology.md](../views/memory-topology.md) |

**Still on this page until a second extract pass** (same hide policy [DATA-30](../context/decisions/DATA.md)): time axis, lane gutter, swimlane canvas, event tooltip/detail strip, compute/memory CSV tabs, hardware details, measure mode, secondary tabs — see historical sections below or [views README stubs](../views/README.md).

Formats hub: [`README.md`](README.md). Adapters: [`ADAPTERS.md`](ADAPTERS.md). Docx/sketch index: [`../ui/VIEW_DATA_MAPPING.md`](../ui/VIEW_DATA_MAPPING.md).

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

### 6. Event tooltip + detail strip

| Input | Requirement |
|-------|-------------|
| Hovered/selected event name + timing | **Required** for tooltip |
| Source paths / PC / dep mini-graph | **Optional** — P2 |

### 9. Compute-load detail tabs — M1

| Input | Requirement |
|-------|-------------|
| Tabs | Compute: `PipeUtilization` / Arithmetic / ResourceConflict; emulate: `PipesUtilization` / hist when packed |
| Hide | Missing CSV → hide tab |

### 12. Memory detail tabs — M1

| Input | Requirement |
|-------|-------------|
| Tabs | Memory L1 / L2Cache / L0 / UB |
| Emulate | **hide** Sept 30 (gap) |

### 13. Timeline time-range measure — M2

See FEATURE_MATRIX / UX_SPEC; sketch `task-measure-mode.jpeg`.

### 14. Hardware details — M1

| Input | Requirement |
|-------|-------------|
| `hardwareDetails` | HardwareInfo.jsonl or OpBasicInfo fallback |
| Emulate | usually **omit** |

### 15. Secondary tabs

Chrome only / disabled ([UI-37](../context/decisions/UI.md)).

### Block scope matrix

See [pipe-occupancy](../views/pipe-occupancy.md) and [memory-topology](../views/memory-topology.md); full matrix historically DATA-28/29/33b/33c.

## Standalone `.json` (PROC-3)

Chrome Trace → timeline only; empty `ReportViewModel` → aside hidden.
