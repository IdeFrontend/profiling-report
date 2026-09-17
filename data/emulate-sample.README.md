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
| `PipeTrace.json` | Timeline (µs): AIC0 + AIV0 processes, Cube/MTE/Scalar/Vector lanes, ~185 µs span with SET_FLAG/WAIT_FLAG sync marks (aligned with `KernelInfo` Task Duration 200 µs and PIPE hist names) |
| `KernelInfo.csv` | Thin report statistics (DATA-47a) |
| `PipesUtilization.csv` / `PipeUtilizationHist.csv` | Compute-load PIPE bars |
| `ArchDiagramMetrics.csv` | Architecture Diagram slots (DATA-48a; gelu-sourced values) |

For a real npu_emulate CSV export pack (export-catalog `manifest.json` + all populated contract CSVs + full instruction Gantt), see [`gelu.README.md`](gelu.README.md) / [`gelu.npu-rep`](gelu.npu-rep).
