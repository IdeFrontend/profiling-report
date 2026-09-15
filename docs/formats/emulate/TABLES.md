# Emulate table inventory

**Profile:** `emulate` (npu_emulate contract SQLite / CSV export).

Scoped catalog for profiling-report consumers. Full contract DB is **100 tables + 22 views** (`total_objects=122`). This doc lists:

1. What a **real producer `.npu-rep` export pack** contains (gelu sample)
2. Tables needed for **Phase 1 / MHTML §11.2.3** / tracing — with pack status
3. Populated-in-DB but **not packed** (packer gap)
4. Empty / flag-gated schema

Contract + leaf pack: [FORMAT.md](FORMAT.md). Sample files: [`data/gelu.npu-rep`](../../../data/gelu.npu-rep), unpacked [`data/gelu/`](../../../data/gelu/), notes [`data/gelu.README.md`](../../../data/gelu.README.md).

## Sample provenance (gelu)

| Field | Value |
|-------|--------|
| Source DB | `0000_gelu_npu_emulated.db` |
| Exported | `2026-09-15T08:04:27.476042+00:00` |
| `total_objects` / tables / views | 122 / 100 / 22 |
| `total_rows` (all objects) | 169435 |
| Leaf embeds | `manifest.json` + **34** populated CSVs + `PipeTrace.json` (+ `aicore_utilization.json`, `core_0_critical_path_report_0.json` in gelu) |
| Export catalog | `manifest.json` — `{ database, exported_at, total_*, objects[] }` with per-object `name`, `type`, `row_count`, `columns`, `file` |

**Export catalog marker.** `manifest.json` **is** the emulate detection signal ([PROC-8](../../context/decisions/PROC.md)): export catalog shape (`objects[]` with hub tables) or thin `{ profile: "emulate", schemaVersion }`. Timeline uses normative **`PipeTrace.json`** (gelu sample renamed from producer `core_*_tracing_report_*.json`; adapter still accepts the native basename as fallback).
---

## 1. Packed embeds in `gelu.npu-rep` (34 CSVs)

Row counts are data rows (header excluded), matching `manifest.json` / on-disk CSVs.

| Table / view | Kind | Rows | Key columns | Notes |
|---|---|---:|---|---|
| `MemoryRWAccesses` | table | 34832 | AccessedAddress, AccessMode, AccessTime, MemoryType, ExecInstrId, CoreId | Memory heatmap |
| `SharedPatterns` | view | 34832 | ExecInstrId, InstrName, AccessedAddress | |
| `UbRwAccesses` | table | 34832 | (2 cols) | |
| `CCUAllTickEvents` | table | 18131 | | |
| `VfPMUValues` | table | 6880 | | |
| `VfPMUDeltasViewPerVf` | view | 6880 | | |
| `ExecutedInstructions` | table | 6031 | ExecInstrId, SourceInstrAddr, ExecInstrTickStart/End, ExecInstrName, ExecInstrParams, InstrTypeId, ExecInstrCoreId, CoreTypeId, ExtendParams, SourceInstrEncoding, **ExecInstrIsWait**, **ExecInstrIsSynchronization**, **ExecInstrIsDurationExcluded**, **ExecInstrVfClass**, **ExecInstrVfSimtClass** | Hub; gelu has 16 columns (extra wait/sync/VF class flags vs older sample) |
| `IPCAsmMetrics` | view | 5381 | ExecInstrId, ScalarIPC, ExecIPC, LdStIPC, BranchIPC | |
| `DispatchTime` | table | 4265 | ExecInstrId, DispatchTimeTick | Chrome Trace dispatch |
| `ScalarIpcDynamic` | table | 4133 | CoreId, CoreTypeId, ExecInstrId, Tick, IPC | Was empty in older transfer sample |
| `ICacheEvents` | table | 2547 | | |
| `SprInfoPerInstr` | table | 2014 | ExecInstrId, SprName, SprValue | |
| `VfIPCDynamic` | table | 1216 | | |
| `VfIPCDynamicView` | view | 1216 | | |
| `VfIPCInside` | table | 1216 | | |
| `UnitsUsageMetrics` | table | 924 | | |
| `UnitUtilization` | table | 736 | Tick, Util, CoreId, CoreTypeId | |
| `PredicateRegValues` | table | 640 | | |
| `VectorUtilizations` | table | 480 | ExecInstrId, ProcessedBytes, ProcessedElements, VectorUtilization | Roofline |
| `VfPMUViewPerSubcore` | view | 430 | | |
| `SprWriteEvents` | table | 350 | | |
| `SIMDSamplingStats` | table | 256 | | |
| `VfPMUMetrics` | table | 215 | | |
| `PMUScalarCounters` | table | 141 | | |
| `ArchDiagramMetrics` | table | 120 | ArchDiagramId, ArchDiagramParameterName, ArchDiagramParameterValue | Arch diagram / BW-ish params |
| `IssueQueueUtilization` | table | 72 | | |
| `ExecQueueUtilization` | table | 72 | | |
| `BrifEvents` | table | 64 | | |
| `CriticalPath` | table | 60 | EventId, InstrId | Was empty / flag-gated in older sample; analyzer ran here |
| `AnalysisState` | table | 33 | AnalysisName, AnalysisPassed | Which analyzers ran (see §5) |
| `DmaMovProcessedBytes` | table | 32 | | |
| `DmaMovSimpleParams` | table | 32 | | |
| `VfIPC` | table | 32 | ExecInstrId, ScalarIPC, ExecIPC, LdStIPC | VF IPC (analyzer ran) |
| `PipeDependency` | table | 30 | ExecInstrId, EventId, EventName, FlowEnd, CategoryId | |

---

## 2. Phase 1 + product UI (MHTML §11.2.3) + tracing — pack status on gelu

| Table / view | Kind | DB rows | In gelu pack? | Used for |
|---|---|---:|---|---|
| `KernelInfo` | table | 17 | **no** | Phase 1 thin summary / identity |
| `ExecutedInstructions` | table | 6031 | yes | Hub; tracing; arch; roofline |
| `ArchDiagramMetrics` | table | 120 | yes | Architecture Diagram |
| `MemoryRWAccesses` | table | 34832 | yes | Memory heatmap |
| `AiCoreOccupancy` | view | 3 | **no** | AICore utilization overlay |
| `PipesUtilization` | table | 24 | **no** | PIPE occupancy / CSV tab |
| `PipeUtilizationHist` | view | 24 | **no** | Util hist |
| `Functions` | table | 0 | no (empty) | Roofline VF names (ELF) |
| `VectorUtilizations` | table | 480 | yes | Roofline |
| `SourceInstructions` | table | 0 | no (empty) | Roofline / source join |
| `VfIPC` | table | 32 | yes | SIMD/SIMT VF IPC |
| `VfSimtIPC` | table | 0 | no (empty) | needs SIMT IPC path |
| `CallGraph` / `CallGraphMetrics` / `CallStacks` / `CallStackIDs` / `CallFunctions` | table | 0 | no (empty) | Call stacks (ELF) |
| `DispatchTime` | table | 4265 | yes | Chrome Trace |
| `InstrTypes` | table | 15 | **no** | Instruction type names |
| `CoreTypes` | table | 3 | **no** | Core type names |
| `PipeDependency` | table | 30 | yes | Chrome Trace flows |
| `ICacheEvents` | table | 2547 | yes | Chrome Trace ICache |
| `ICacheRefillEvents` | table | 11 | **no** | |
| `QueueFullEvents` | table | 0 | no (empty) | |
| `UnitUtilization` | table | 736 | yes | |
| `IssueQueueUtilization` / `ExecQueueUtilization` | table | 72 | yes | |

---

## 3. Populated in DB but **not** packed into gelu leaf

Export packer skipped these despite `row_count > 0`. Packers aiming at Sept 30 / MHTML surfaces should **not** assume “present in DB ⇒ present in `.npu-rep`”.

| Name | Kind | Rows |
|---|---|---:|
| `InstrNameHistClocks` | view | 57 |
| `InstrNameHistCount` | view | 57 |
| `VfPMUSummary` | table | 32 |
| `PipeUtilizationHist` | view | 24 |
| `PipesUtilization` | table | 24 |
| `KernelInfo` | table | 17 |
| `InstrTypes` | table | 15 |
| `ActiveInstrTypes` | view | 12 |
| `InstrTypeHistClocks` | view | 12 |
| `InstrTypeHistCount` | view | 12 |
| `HintTypes` | table | 11 |
| `ICacheRefillEvents` | table | 11 |
| `InstrQueueTypes` | table | 9 |
| `SIMDStallsByAddr` | table | 8 |
| `AiCoreOccupancy` | view | 3 |
| `CoreTypes` | table | 3 |
| `ICacheStartingPCs` | table | 3 |

---

## 4. Empty-but-schema-important (often flag / ELF gated)

71 objects have `row_count=0` in gelu (not packed). Notable:

| Name | Notes |
|---|---|
| `SourceFiles` / `SourceLines` / `DebugInfo` / `BasicBlocks` / `Functions` | ELF / `--object-file` |
| `TraceBubbles` / `TraceBubbleSummary` | `--bubble` |
| `VfSimtIPC*` / `VfSimtInvocations` | SIMT IPC path |
| `Call*` | Call stacks (ELF) |
| `MemoryUtilizationStates` | `--memory-utilization` |
| `DCacheHitMissEvents` | quantitative indices |
| `QueueFullEvents` / `QueueFullStalls` | not triggered on gelu |

Full name list: `data/gelu/manifest.json` → `objects` where `row_count == 0`.

---

## 5. `AnalysisState` on gelu (analyzers that ran)

All rows `AnalysisPassed=1` except `ascend950_pipe_dependency_buffers=0`. Passed includes: pipe utilization/dependency, arch_diagram, vf_ipc, scalar_ipc (+ dynamic), unit/subqueue utilization, simd sampling, **critical_path**, vector_utilization, dma_mov*, mmad, fixp, region_tracing, …

---

## 6. Older transfer sample

Pre-gelu inventory used export `2026-09-09` (`total_rows=67067`). Prefer **gelu** row counts and pack membership above when documenting what lands in a producer `.npu-rep`.
