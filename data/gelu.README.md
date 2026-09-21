# gelu — npu_emulate export sample

Sole committed emulate fixture and playground sample. Real producer pack from npu_emulate (`0000_gelu_npu_emulated.db`). Timeline uses the producer basename `core_0_tracing_report_0.json` (adapter also accepts normative `PipeTrace.json`).

| Item | Value |
|------|--------|
| Packed | [`gelu.npu-rep`](gelu.npu-rep) (~7.7 MiB, **not** Git LFS — intentional demo fixture) |
| SHA-256 | `b72c523faf3ac2984e98064f2759f87dcd3bb5afe77389bf97ec0903403a0efb` |
| Exported | `2026-09-21T12:05:51.821657+00:00` |
| Contract DB objects | 124 (101 tables + 23 views), 161314 rows total |
| Leaf embeds | `manifest.json` + **53** CSVs + `core_0_tracing_report_0.json` + `aicore_utilization.json` |

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
| `HintMessages.csv` / `HintTypes.csv` / `InstructionHints.csv` / `KernelHints.csv` / `SourceLineHints.csv` | Performance hints (packed CSVs; manifest `row_count` is 0 except `HintTypes`) |

## Packed embeds (56)

53 contract CSVs + `manifest.json`, plus:

- `core_0_tracing_report_0.json` (Chrome Trace — timeline)
- `aicore_utilization.json`

Performance-hint CSVs in the pack: `HintMessages.csv`, `HintTypes.csv`, `InstructionHints.csv`, `KernelHints.csv`, `SourceLineHints.csv`.
