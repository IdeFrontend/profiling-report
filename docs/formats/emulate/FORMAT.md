# Emulate profile format

**Profile:** `emulate` (npu_emulate / Ascend cycle-accurate OP simulation).

Shared container: [formats README](../README.md). Table inventory: [TABLES.md](TABLES.md). Compute profile: [../compute/FORMAT.md](../compute/FORMAT.md). Adaptation: [../ADAPTERS.md](../ADAPTERS.md).

Decisions: [PROC-6](../../context/decisions/PROC.md) … [PROC-8](../../context/decisions/PROC.md), [DATA-40](../../context/decisions/DATA.md), [DATA-41](../../context/decisions/DATA.md).

---

## 1. Role

npu_emulate builds a **contract SQLite database** (or CSV export of that DB) from a simulated kernel run, then generates HTML/JSON/SVG reports. Product delivery into Asc Toolkit is still **`.npu-rep`** ([PROC-6](../../context/decisions/PROC.md)) — a leaf archive whose embeds are **simulator-native**, not hardware OpBasicInfo / PipeUtilization schemas ([DATA-40](../../context/decisions/DATA.md)).

| Concern | Compute profile | Emulate profile |
|---------|------------------|-------------------|
| Grain | OP / block aggregates + pipe-busy timeline | Instruction / **tick** events |
| Hub identity | `OpBasicInfo.csv` | `KernelInfo` + `ExecutedInstructions` |
| Timeline | `PipeTrace.json` / `trace.json` | Emulate Chrome Trace → packed as `PipeTrace.json` (µs) |
| Detection | (no marker) | `EmulateManifest.json` ([PROC-8](../../context/decisions/PROC.md)) |

---

## 2. Data model (contract DB)

Sources of tables (from npu_emulate docs):

| Layer | Origin | Examples |
|-------|--------|----------|
| Contract input | Simulator / mock DB | `KernelInfo`, `ExecutedInstructions`, `DispatchTime`, `MemoryRWAccesses`, `BrifEvents`, `PMUScalarCounters`, … |
| Bridge / dictionary | Startup + optional ELF | `InstrTypes`, `CoreTypes`, `SourceFiles`, `Functions`, aggregation views |
| Analysis output | Analyzers (often flag-gated) | `ArchDiagramMetrics`, `PipesUtilization`, `VfIPC*`, `TraceBubbles`, `VfPMU*` |
| Hints | hints.sql | `HintTypes`, hint views |

**Hub table:** `ExecutedInstructions` — almost every report joins on it (cores, tick ranges, instr names/types).

**Time base:** simulation uses integer **ticks**. When packing `PipeTrace.json` for this viewer, the producer **MUST** convert ticks → **µs** ([DATA-41](../../context/decisions/DATA.md)).

**Flag-gated depth:** many analysis tables stay empty unless analyzers run (`--bubble`, `--vec-ipc`, `--simd-perf`, `--object-file`, …). Packers MUST only claim capabilities for populated embeds.

---

## 3. Native emulate report outputs (reference)

npu_emulate `report` already emits (among others):

- Per-core Chrome Trace JSON (`core_*_tracing_report_*.json`)
- `aicore_utilization.json`, `summary.json`
- Arch diagram SVGs, HTML charts, bubble JSON, …

Profiling-report does **not** re-implement those HTML generators. It consumes a **packed leaf** (§4) and maps into shared view-models.

---

## 4. Leaf pack (inside `.npu-rep`)

Two shapes appear in the wild:

| Shape | Example | Marker | Typical embeds |
|-------|---------|--------|----------------|
| **CSV export pack** (producer dump) | [`data/gelu.npu-rep`](../../../data/gelu.npu-rep) | `manifest.json` (export catalog; **not** a viewer profile marker) | Populated contract CSVs only — gelu packs **34** tables/views; see [TABLES.md](TABLES.md) |
| **Viewer leaf** (Sept 30+) | [`data/emulate-sample.npu-rep`](../../../data/emulate-sample.npu-rep) | **`EmulateManifest.json`** ([PROC-8](../../context/decisions/PROC.md)) | Manifest + `PipeTrace.json` + KernelInfo/summary + PIPE CSVs (± more contract CSVs) |

gelu shows the export packer **skips** some populated DB objects (`KernelInfo`, `PipesUtilization`, `AiCoreOccupancy`, dictionaries, …). A viewer-ready leaf MUST still include the Sept 30 embeds below even when they were omitted from a raw export pack.

### 4.1 Sept 30 leaf (required + recommended)

| Embed | Type | Rules |
|-------|------|-------|
| `EmulateManifest.json` | json | Required marker. See §4.3 |
| `PipeTrace.json` | json | Chrome Trace Event format; **µs** `ts`/`dur` ([DATA-41](../../context/decisions/DATA.md)). Prefer packing emulate Chrome Tracing output (rename/normalize to this basename) |
| `KernelInfo.csv` and/or `summary.json` | csv / json | Thin duration / identity cards. Interim map [DATA-42a](../../context/decisions/interim/DATA.md); Product [DATA-42](../../context/questions/DATA.md) |
| `PipesUtilization.csv` and/or `PipeUtilizationHist.csv` | csv | **Recommended** for PIPE occupancy / CSV tab. Keep emulate basenames — **do not** rename to compute `PipeUtilization.csv` ([DATA-40](../../context/decisions/DATA.md)) |

Optional: additional contract CSVs may be packed unused for later phases.

**Not required for Sept 30:** sqlite3 blob (container type `5` remains reserved). Prefer CSV embeds matching export basenames (`ExecutedInstructions.csv`, …).
### 4.2 Post–Sept 30 (capability-driven)

Pack when the corresponding capability should light up (see [FEATURE_MATRIX](../../ui/FEATURE_MATRIX.md), [ADAPTERS.md](../ADAPTERS.md), [VIEW_DATA_REQUIREMENTS](../VIEW_DATA_REQUIREMENTS.md) gaps):

| Capability (reserved) | Typical embeds |
|----------------------|----------------|
| `archDiagram` | `ArchDiagramMetrics.csv`, `ExecutedInstructions.csv` |
| `memoryHeatmap` | `MemoryRWAccesses.csv` |
| AiCore occupancy overlay | `AiCoreOccupancy.csv` and/or `aicore_utilization.json` |
| `vfIpc` | `VfIPC.csv`, `VfSimtIPC.csv` (need `--vec-ipc`) |
| `callStacks` | Call* tables (need ELF / `--object-file`) |
| `roofline` | ArchDiagramMetrics + Functions + ExecutedInstructions + VectorUtilizations + SourceInstructions (gap vs compute Arithmetic+Memory) |
| `memoryDiagram` | **gap** — not MemoryRWAccesses; needs aggregate BW map or Product slot names from ArchDiagramMetrics |

### 4.3 `EmulateManifest.json` (viewer marker)

Minimum shape:

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
| `profile` | yes | Must be `"emulate"` |
| `schemaVersion` | yes | Integer; start at `1` |
| `producer` | no | e.g. `npu_emulate` |
| `tickToUs` | no | Scale factor used when converting ticks → µs for PipeTrace; informational |

Additional fields allowed; unknown keys ignored by the viewer.

**Do not confuse with `manifest.json`.** Export packs (gelu) embed `manifest.json` listing every contract object (`name`, `type`, `row_count`, `columns`, `file`). That file does **not** satisfy PROC-8 detection; `adaptEmulate` looks only for `EmulateManifest.json` with `profile: "emulate"`.
---

## 5. Product UI mapping (MHTML §11.2.3)

Product maps Biprof features → Asc Toolkit using **simulator CSV names** (not hardware embeds):

| § | Feature | Primary sources |
|---|---------|-----------------|
| 11.2.3.1 | Architecture Diagram | `ArchDiagramMetrics`, `ExecutedInstructions` |
| 11.2.3.2 | Memory Utilization Heatmap | `MemoryRWAccesses` |
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
2. If `EmulateManifest.json` present → **simulator** adapter.
3. Phase 1: build `SwimlaneModel` from `PipeTrace.json`; thin `ReportViewModel.summary*` from KernelInfo/summary when mappable; omit PIPE/memory/roofline until sources + mappers exist ([DATA-30](../../context/decisions/DATA.md)).
4. Phase 2: set capabilities when embeds present; never invent hardware CSVs ([DATA-40](../../context/decisions/DATA.md)).

---

## 7. Reference sample (gelu)

Committed producer export: [`data/gelu.npu-rep`](../../../data/gelu.npu-rep) (+ unpacked [`data/gelu/`](../../../data/gelu/)). Use it to validate CSV schemas and table membership; it is **not** a Sept 30 viewer leaf until `EmulateManifest.json` + `PipeTrace.json` (+ recommended KernelInfo / PIPE CSVs) are added. Table set: [TABLES.md](TABLES.md).

Minimal viewer fixture: [`data/emulate-sample.npu-rep`](../../../data/emulate-sample.npu-rep).

---

## 8. Open

| Item | Id |
|------|-----|
| Dedicated head `origin` | [PROC-9](../../context/questions/PROC.md) |
| KernelInfo / summary.json → summary cards | [DATA-42](../../context/questions/DATA.md) |
| Exact `tickToUs` default when freq unknown | [DATA-42](../../context/questions/DATA.md) / producer docs |
| Whether export `manifest.json` alone should detect emulate (today: **no**) | Product / packer alignment with [PROC-8](../../context/decisions/PROC.md) |
| Export packer omitting populated KernelInfo / PipesUtilization / AiCoreOccupancy | Packer bug vs intentional slim pack — blocks Sept 30 leaf from raw gelu as-is |