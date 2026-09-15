# Emulate sample leaf

Minimal Sept 30 fixture payloads for a product `.npu-rep` emulate leaf.

Pack:

```bash
python3 data/scripts/pack_rep.py data/emulate-sample data/emulate-sample.npu-rep
```

Embeds: `EmulateManifest.json`, `PipeTrace.json` (µs), `KernelInfo.csv`, `PipesUtilization.csv`, `PipeUtilizationHist.csv`.
