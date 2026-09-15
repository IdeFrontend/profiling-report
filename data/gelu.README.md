# gelu — npu_emulate export sample

Real producer pack from npu_emulate (`0000_gelu_npu_emulated.db`), repacked so the timeline embed uses the normative **`PipeTrace.json`** basename (source was `core_0_tracing_report_0.json`).

| Item | Value |
|------|--------|
| Packed | [`gelu.npu-rep`](gelu.npu-rep) (~9.9 MiB) |
| Unpacked | [`gelu/`](gelu/) |
| SHA-256 | `0d1e4e0eb4a77a1c063d9b05b1f55747f61efa1da93f4a7de7ea4c8ba065f083` |
| Exported | `2026-09-15T08:04:27.476042+00:00` |
| Contract DB objects | 122 (100 tables + 22 views), 169435 rows total |
| Leaf embeds | `manifest.json` + **34** CSVs + `PipeTrace.json` + `aicore_utilization.json` + `core_0_critical_path_report_0.json` |

## Unpack / re-pack

```bash
python3 data/scripts/unpack_rep.py data/gelu.npu-rep /tmp/gelu-out
# After editing embeds:
# python3 data/scripts/pack_rep.py /tmp/gelu-out data/gelu-repacked.npu-rep
```

## Viewer behavior

Detected as **emulate** via export-catalog `manifest.json` ([PROC-8](../docs/context/decisions/PROC.md)). Timeline from **`PipeTrace.json`** (µs per [DATA-41](../docs/context/decisions/DATA.md); native file may still label `displayTimeUnit: "ns"`). KernelInfo / PIPE CSVs still not packed → empty Sept 30 aside bars. See [docs/formats/emulate/TABLES.md](../docs/formats/emulate/TABLES.md).

Minimal leaf with KernelInfo + PIPE: [`emulate-sample.npu-rep`](emulate-sample.npu-rep).

## Packed embeds (38)

34 contract CSVs + `manifest.json`, plus:

- `PipeTrace.json` (Chrome Trace — timeline; renamed from producer `core_0_tracing_report_0.json`)
- `aicore_utilization.json`
- `core_0_critical_path_report_0.json`
