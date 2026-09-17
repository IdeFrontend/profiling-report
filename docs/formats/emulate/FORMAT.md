# Emulate profile format

**Profile:** `emulate` (npu_emulate / Ascend cycle-accurate OP simulation).

Shared container: [formats README](../README.md). Column/type SSOT: [SCHEMA.md](SCHEMA.md). Pack / Phase 1 inventory: [TABLES.md](TABLES.md). **Embed → lit view (Sept 30):** [§4.1](#41-embeds-used-by-report-visualization-sept-30--m4). Compute profile: [../compute/FORMAT.md](../compute/FORMAT.md). Adaptation: [../ADAPTERS.md](../ADAPTERS.md).

Decisions: [PROC-6](../../context/decisions/PROC.md) … [PROC-8](../../context/decisions/PROC.md), [DATA-45](../../context/decisions/DATA.md), [DATA-46](../../context/decisions/DATA.md).

---

## 1. Role

npu_emulate builds a **contract SQLite database** (or CSV export of that DB) from a simulated kernel run, then generates HTML/JSON/SVG reports. Product delivery into Asc Toolkit is still **`.npu-rep`** ([PROC-6](../../context/decisions/PROC.md)) — a leaf archive whose embeds are **simulator-native**, not hardware OpBasicInfo / PipeUtilization schemas ([DATA-45](../../context/decisions/DATA.md)).

| Concern | Compute profile | Emulate profile |
|---------|------------------|-------------------|
| Grain | OP / block aggregates + pipe-busy timeline | Instruction / **tick** events |
| Hub identity | `OpBasicInfo.csv` | `KernelInfo` + `ExecutedInstructions` |
| Timeline | `PipeTrace.json` / `trace.json` | Emulate Chrome Trace → packed as `PipeTrace.json` (µs) |
| Detection | (no marker) | `manifest.json` ([PROC-8](../../context/decisions/PROC.md)) |

---

## 2. Data model (contract DB)

Sources of tables (from npu_emulate docs):

| Layer | Origin | Examples |
|-------|--------|----------|
| Contract input | Simulator / mock DB | `KernelInfo`, `ExecutedInstructions`, `DispatchTime`, `MemoryRWAccesses`, `BrifEvents`, `PMUScalarCounters`, … |
| Bridge / dictionary | Startup + optional ELF | `InstrTypes`, `CoreTypes`, `SourceFiles`, `Functions`, aggregation views |
| Analysis output | Analyzers (often flag-gated) | `ArchDiagramMetrics`, `PipesUtilization`, `VfIPC*`, `TraceBubbles`, `VfPMU*` |
| Hints | hints.sql | `HintTypes`, hint views |

**Field catalog:** every contract object and column (name, SQL type, description) is listed in **[SCHEMA.md](SCHEMA.md)**, generated from `manifest.json` inside [`data/gelu.npu-rep`](../../../data/gelu.npu-rep). That embed is the SSOT for schema shape; this section only describes layers and packing rules.

**Hub table:** `ExecutedInstructions` — almost every report joins on `ExecInstrId` (cores, tick ranges, instr names/types). See [SCHEMA § ExecutedInstructions](SCHEMA.md#executedinstructions).

**Time base:** simulation uses integer **ticks**. When packing `PipeTrace.json` for this viewer, the producer **MUST** convert ticks → **µs** ([DATA-46](../../context/decisions/DATA.md)).

**Flag-gated depth:** many analysis tables stay empty unless analyzers run (`--bubble`, `--vec-ipc`, `--simd-perf`, `--object-file`, …). Packers MUST only claim capabilities for populated embeds.

---

## 3. Native emulate report outputs (reference)

npu_emulate `report` already emits (among others):

- Per-core Chrome Trace JSON (`core_*_tracing_report_*.json`)
- `aicore_utilization.json`
- Arch diagram SVGs, HTML charts, bubble JSON, …

Profiling-report does **not** re-implement those HTML generators. It consumes a **packed leaf** (§4) and maps into shared view-models.

---

## 4. Leaf pack (inside `.npu-rep`)

Two shapes appear in the wild:

| Shape | Example | Marker | Typical embeds |
|-------|---------|--------|----------------|
| **CSV export pack** (producer dump) | [`data/gelu.npu-rep`](../../../data/gelu.npu-rep) | `manifest.json` (export catalog — **is** the emulate marker per [PROC-8](../../context/decisions/PROC.md)) | All populated contract CSVs + timeline (`core_*_tracing_report_*.json` or normative `PipeTrace.json`) + optional `aicore_utilization.json` |
| **Viewer leaf** (Sept 30+) | [`data/emulate-sample.npu-rep`](../../../data/emulate-sample.npu-rep) | `manifest.json` thin `{ profile, schemaVersion }` | Manifest + `PipeTrace.json` + KernelInfo + PIPE CSVs (± more contract CSVs) |

gelu (2026-09-17) packs **every** `row_count > 0` object, including KernelInfo / PIPE / ArchDiagramMetrics — see [TABLES.md](TABLES.md) §1–3.

### 4.1 Embeds used by report visualization (Sept 30 / M4)

Packer checklist for the **currently lit** Asc Toolkit surfaces. Missing embeds → **hide** that surface ([DATA-30](../../context/decisions/DATA.md)); the leaf still opens. Do **not** invent compute-shaped names ([DATA-45](../../context/decisions/DATA.md)).

| Embed (basename in `.npu-rep`) | View / surface | Adapter fill | Notes |
|--------------------------------|----------------|--------------|-------|
| `manifest.json` | Emulate detection | `isEmulateLeaf` / `adaptEmulate` | Required marker ([PROC-8](../../context/decisions/PROC.md)). Thin `{ profile, schemaVersion }` **or** export catalog |
| `PipeTrace.json` | [Timeline](../../views/timeline.md) | `SwimlaneModel` (`sourceTimeUnit: us`) | **µs** `ts`/`dur` ([DATA-46](../../context/decisions/DATA.md)). Native `core_*_tracing_report_*.json` accepted if `PipeTrace.json` absent. Absent → null swimlane |
| `KernelInfo.csv` | [Report statistics](../../views/report-summary.md) | `reportModel.summary*` | Thin identity / duration ([DATA-47a](../../context/decisions/interim/DATA.md)). Absent → hide cards |
| `PipeUtilizationHist.csv` (preferred) and/or `PipesUtilization.csv` | [PIPE occupancy](../../views/pipe-occupancy.md) + 计算 详情 | `pipeOccupancy` + `computeTables` | Keep emulate basenames. Absent / all-NA → hide PIPE |
| `ArchDiagramMetrics.csv` | [Architecture Diagram](../../views/arch-diagram.md) | `memoryTopology` + capability `archDiagram` | Interim plated chrome ([DATA-48a](../../context/decisions/interim/DATA.md)). Absent / undrawable → omit `archDiagram` |

**Also lit when the above mount:** StatsAside CANNBot scopes (summary / compute / memory) from the same adapted fields — no extra embeds.

**Reference leaf with all five:** [`data/emulate-sample.npu-rep`](../../../data/emulate-sample.npu-rep). Roadmap: [milestone-4](../../process/roadmap/milestone-4.md). Per-surface detail: [`../../views/`](../../views/).

### 4.2 Not used for Sept 30 visualization (packed or not)

| Embed / table | Product surface | Status |
|---------------|-----------------|--------|
| `MemoryRWAccesses.csv` | Memory Utilization Heatmap | **out** ([DATA-49](../../context/questions/DATA.md)) |
| compute `Memory*.csv` / `memoryDiagram` | Asc 内存负载 | n/a on emulate |
| `AiCoreOccupancy.csv` / `aicore_utilization.json` | AICore occupancy overlay | out-of-scope |
| `VfIPC*.csv` / `VfSimtIPC.csv` | SIMD/SIMT VF IPC | out-of-scope |
| Call* / CallGraph* | Call stacks | out-of-scope |
| Roofline inputs (`Functions`, `ExecutedInstructions`, `VectorUtilizations`, …) | Roofline | **hide** (gap) |
| `Sampling.json` | Overview charts | **hide** (gap) |

Optional: other contract CSVs may be packed unused for later phases. **Not required:** sqlite3 blob (container type `5` reserved).

### 4.3 `manifest.json` (emulate marker)

**Thin marker** (viewer leaf / `emulate-sample`):

```json
{
  "profile": "emulate",
  "schemaVersion": 1,
  "producer": "npu_emulate",
  "tickToUs": null
}
```

| Field | Required | Meaning |
|-------|----------|---------|
| `profile` | yes (thin) | Must be `"emulate"` |
| `schemaVersion` | yes (thin) | Integer; start at `1` |
| `producer` | no | e.g. `npu_emulate` |
| `tickToUs` | no | Scale factor used when converting ticks → µs for PipeTrace; informational |

**Export catalog** (producer dump / gelu): object with `objects[]` where some entry `name` is `ExecutedInstructions`, `KernelInfo`, or `AnalysisState`. Thin `profile` fields are not required for this shape.

Additional fields allowed; unknown keys ignored by the viewer.
---

## 5. Product UI mapping (MHTML §11.2.3)

Product maps Biprof features → Asc Toolkit using **simulator CSV names** (not hardware embeds):

| § | Feature | Primary sources |
|---|---------|-----------------|
| 11.2.3.1 | Architecture Diagram | `ArchDiagramMetrics` (interim plated chrome; [DATA-48a](../../context/decisions/interim/DATA.md)) |
| 11.2.3.2 | Memory Utilization Heatmap | `MemoryRWAccesses` — **out** Sept 30 ([DATA-49](../../context/questions/DATA.md)) |
| 11.2.3.3 | AICore Utilization | `AiCoreOccupancy` (+ `aicore_utilization.json`) |
| 11.2.3.4 | Sub Core / pipeline util | `PipesUtilization` |
| 11.2.3.5 | Roofline | ArchDiagramMetrics, Functions, ExecutedInstructions, VectorUtilizations, SourceInstructions |
| 11.2.3.6 | Pipeline utilizations | `PipesUtilization` |
| 11.2.3.7 | SIMD/SIMT VF IPC | `VfIPC`, `VfSimtIPC` |
| 11.2.3.8 | Call Stacks | CallGraph*, CallStacks*, CallFunctions (ELF) |

Display ↔ field detail: [VIEW_DATA_MAPPING.md](../../ui/VIEW_DATA_MAPPING.md) § Simulator. Hide rules (adapted VM): [VIEW_DATA_REQUIREMENTS.md](../VIEW_DATA_REQUIREMENTS.md).

---

## 6. Viewer behavior (summary)

1. Parse `.npu-rep` leaf payloads ([INPUT_FORMATS](../README.md)).
2. If emulate `manifest.json` (thin profile or export catalog) → **emulate** adapter.
3. Sept 30 (M4): build `SwimlaneModel` from `PipeTrace.json` when present (else null swimlane); thin `summary*` from KernelInfo; PIPE from PipesUtilization/hist; Architecture Diagram from ArchDiagramMetrics into interim plated chrome (`memoryTopology` carrier, capability `archDiagram`, [DATA-48a](../../context/decisions/interim/DATA.md)); hide overview/roofline/heatmap gaps ([DATA-30](../../context/decisions/DATA.md)).
4. Later: set more capabilities when embeds present; never invent hardware CSVs ([DATA-45](../../context/decisions/DATA.md)).

---

## 7. Reference sample (gelu)

Committed producer export: [`data/gelu.npu-rep`](../../../data/gelu.npu-rep). Detected as emulate via export-catalog `manifest.json`; timeline from `core_0_tracing_report_0.json` (or normative `PipeTrace.json`). Table set: [TABLES.md](TABLES.md).

Minimal viewer fixture (timeline + summary + PIPE): [`data/emulate-sample.npu-rep`](../../../data/emulate-sample.npu-rep).

---

## 8. Open

| Item | Id |
|------|-----|
| Dedicated head `origin` | [PROC-9](../../context/questions/PROC.md) |
| KernelInfo → summary cards | [DATA-47](../../context/questions/DATA.md) |
| ArchDiagramMetrics → Architecture Diagram slots | [DATA-48](../../context/questions/DATA.md) (interim [DATA-48a](../../context/decisions/interim/DATA.md)) |
| Dedicated ArchDiagramModel / biprof chrome; heatmap deferral | [DATA-49](../../context/questions/DATA.md) |
| Exact `tickToUs` default when freq unknown | [DATA-47](../../context/questions/DATA.md) / producer docs |
| KernelInfo duration attrs (`exec_time_ns` vs `duration(us)`) for thin summary | [DATA-47](../../context/questions/DATA.md) |
| Synthesizing PipeTrace from ExecutedInstructions / DispatchTime | Future — not required to open |
