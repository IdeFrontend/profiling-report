# Emulate sample leaf

Minimal Sept 30 / M4 fixture payloads for a product `.npu-rep` emulate leaf.

Pack:

```bash
rm -f data/emulate-sample.npu-rep
python3 data/scripts/pack_rep.py data/emulate-sample data/emulate-sample.npu-rep
```

Embeds:

| File | Role |
|------|------|
| `manifest.json` | Thin `{ profile: "emulate", schemaVersion }` |
| `PipeTrace.json` | Timeline (µs) |
| `KernelInfo.csv` | Thin report statistics (DATA-47a) |
| `PipesUtilization.csv` / `PipeUtilizationHist.csv` | Compute-load PIPE bars |
| `ArchDiagramMetrics.csv` | Memory topology slots (DATA-48a; gelu-sourced values) |

For a real npu_emulate CSV export pack (export-catalog `manifest.json` + contract CSVs), see [`gelu.README.md`](gelu.README.md) / [`gelu.npu-rep`](gelu.npu-rep). gelu often omits KernelInfo / PIPE CSVs until the packer includes them ([milestone-4](../docs/process/roadmap/milestone-4.md)).
