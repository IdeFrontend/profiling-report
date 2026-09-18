# gelu — npu_emulate export sample

Real producer pack from npu_emulate (`0000_gelu_npu_emulated.db`). Timeline uses the producer basename `core_0_tracing_report_0.json` (adapter also accepts normative `PipeTrace.json`).

| Item | Value |
|------|--------|
| Packed | [`gelu.npu-rep`](gelu.npu-rep) (~9.7 MiB, **not** Git LFS — intentional demo fixture; slim leaf is [`emulate-sample.npu-rep`](emulate-sample.npu-rep)) |
| SHA-256 | `e9ee81ded874ddd456c17cf09470611ada11598d9b2b183a7d5fafae0f55a11b` |
| Exported | `2026-09-17T13:53:46.122341+00:00` |
| Contract DB objects | 122 (100 tables + 22 views), 170378 rows total |
| Leaf embeds | `manifest.json` + **51** CSVs + `core_0_tracing_report_0.json` + `aicore_utilization.json` + `core_0_critical_path_report_0.json` |

## Unpack (local only — not committed)

```bash
python3 data/scripts/unpack_rep.py data/gelu.npu-rep /tmp/gelu-out
# After editing embeds:
# python3 data/scripts/pack_rep.py /tmp/gelu-out data/gelu-repacked.npu-rep
```

## Viewer behavior (§4.1)

Detected as **emulate** via export-catalog `manifest.json` ([PROC-8](../docs/context/decisions/PROC.md)).

| Embed | Surface |
|-------|---------|
| `core_0_tracing_report_0.json` | Timeline (native name; µs contract [DATA-46](../docs/context/decisions/interim/DATA.md#data-46)) |
| `KernelInfo.csv` | Packed when present; **not** used for summary chrome ([DATA-47](../docs/context/decisions/DATA.md)) |
| `PipeUtilizationHist.csv` / `PipesUtilization.csv` | PIPE occupancy |
| `ArchDiagramMetrics.csv` | Architecture Diagram (`archDiagram`, interim plated chrome [DATA-48a](../docs/context/decisions/interim/DATA.md)) |

Full aside demo leaf (thin marker): [`emulate-sample.npu-rep`](emulate-sample.npu-rep).

## Packed embeds (55)

51 contract CSVs + `manifest.json`, plus:

- `core_0_tracing_report_0.json` (Chrome Trace — timeline)
- `aicore_utilization.json`
- `core_0_critical_path_report_0.json`
