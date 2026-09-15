# gelu — npu_emulate export sample

Real producer pack from npu_emulate (`0000_gelu_npu_emulated.db`), not the minimal Sept 30 viewer leaf (`emulate-sample`).

| Item | Value |
|------|--------|
| Packed | [`gelu.npu-rep`](gelu.npu-rep) (~5.7 MiB) |
| Unpacked | [`gelu/`](gelu/) |
| SHA-256 | `37d387a29229a2052f2139b68ca416d4910f25916aed9ec7cbef39aadf093e9e` |
| Exported | `2026-09-15T08:04:27.476042+00:00` |
| Contract DB objects | 122 (100 tables + 22 views), 169435 rows total |
| Leaf embeds | `manifest.json` + **34** populated CSVs |

## Unpack / re-pack

```bash
python3 data/scripts/unpack_rep.py data/gelu.npu-rep /tmp/gelu-out
# pack from directory (creates a new file; do not overwrite in place):
# python3 data/scripts/pack_rep.py data/gelu data/gelu-repacked.npu-rep
```

## What this pack is / is not

**Is:** flat `npu-rep` leaf of contract CSV export + export catalog (`manifest.json`).

**Is not:** viewer Sept 30 leaf. Missing `EmulateManifest.json`, `PipeTrace.json`, and several DB-populated tables that the export packer skipped (e.g. `KernelInfo`, `PipesUtilization`, `AiCoreOccupancy`). See [docs/formats/emulate/TABLES.md](../docs/formats/emulate/TABLES.md) and [FORMAT.md](../docs/formats/emulate/FORMAT.md) §4 / §8.

## Packed embeds (35)

`manifest.json`, `AnalysisState.csv`, `ArchDiagramMetrics.csv`, `BrifEvents.csv`, `CCUAllTickEvents.csv`, `CriticalPath.csv`, `DispatchTime.csv`, `DmaMovProcessedBytes.csv`, `DmaMovSimpleParams.csv`, `ExecQueueUtilization.csv`, `ExecutedInstructions.csv`, `ICacheEvents.csv`, `IPCAsmMetrics.csv`, `IssueQueueUtilization.csv`, `MemoryRWAccesses.csv`, `PMUScalarCounters.csv`, `PipeDependency.csv`, `PredicateRegValues.csv`, `SIMDSamplingStats.csv`, `ScalarIpcDynamic.csv`, `SharedPatterns.csv`, `SprInfoPerInstr.csv`, `SprWriteEvents.csv`, `UbRwAccesses.csv`, `UnitUtilization.csv`, `UnitsUsageMetrics.csv`, `VectorUtilizations.csv`, `VfIPC.csv`, `VfIPCDynamic.csv`, `VfIPCDynamicView.csv`, `VfIPCInside.csv`, `VfPMUDeltasViewPerVf.csv`, `VfPMUMetrics.csv`, `VfPMUValues.csv`, `VfPMUViewPerSubcore.csv`.
