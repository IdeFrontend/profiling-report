# Emulate sample leaf

Minimal Sept 30 fixture payloads for a product `.npu-rep` emulate leaf.

Pack:

```bash
python3 data/scripts/pack_rep.py data/emulate-sample data/emulate-sample.npu-rep
```

Embeds: `manifest.json` (`profile: "emulate"`), `PipeTrace.json` (µs), `KernelInfo.csv`, `PipesUtilization.csv`, `PipeUtilizationHist.csv`.

For a real npu_emulate CSV export pack (export-catalog `manifest.json` + contract CSVs, often no PipeTrace), see [`gelu.README.md`](gelu.README.md) / [`gelu.npu-rep`](gelu.npu-rep).
