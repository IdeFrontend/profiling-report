# gelu — npu_emulate export sample

Sole committed emulate fixture and playground sample. Real producer pack from npu_emulate (`0000_gelu_npu_emulated.db`). Timeline uses the producer basename `core_0_tracing_report_0.json` (adapter also accepts normative `PipeTrace.json`).

| Item | Value |
|------|--------|
| Packed | [`gelu.npu-rep`](gelu.npu-rep) (~7.8 MiB, Git LFS; the Vercel install runs [`scripts/checkout-lfs.sh`](../scripts/checkout-lfs.sh) to pull it) |
| SHA-256 | `abbab1a91f40ddf545d2f7074f4cb042647539bef5a0660a4ad0d4f2286144ca` |
| Exported | `2026-09-21T12:05:51.821657+00:00` |
| Contract DB objects | 124 (101 tables + 23 views), 161314 rows total |
| Leaf embeds | `manifest.json` + **55** CSVs + `core_0_tracing_report_0.json` + `aicore_utilization.json` |

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
| `core_0_tracing_report_0.json` | Timeline (native name; µs contract [DATA-46](../docs/context/decisions/interim/DATA.md#data-46)); Trace `ph:C` mem util pipes → swim **Memory utilization** CounterTracks ([DATA-57](../docs/context/decisions/DATA.md) / #208) |
| `KernelInfo.csv` | Packed when present; **not** used for summary chrome ([DATA-47](../docs/context/decisions/DATA.md)) |
| `PipeUtilizationHist.csv` / `PipesUtilization.csv` | PIPE occupancy |
| `ArchDiagramMetrics.csv` | Architecture Diagram (`archDiagram`, interim plated chrome [DATA-48a](../docs/context/decisions/interim/DATA.md)) |
| `MemoryHeatmapLayout.csv` + `MemoryHeatmapCells.csv` | Memory Utilization Heatmap (§11.2.3.2) — producer lattice + capacity (demo embeds from FALite pack, 2026-10-29; [DATA-50](../docs/context/decisions/DATA.md)) |
| `UbRwAccesses.csv` | Packed; **not** a heat source (no Layout/Cells → omit `memoryHeatmap`) |
| `HintMessages.csv` / `HintTypes.csv` / `InstructionHints.csv` / `KernelHints.csv` / `SourceLineHints.csv` | Performance hints (packed CSVs; manifest `row_count` is 0 except `HintTypes`) |

## Packed embeds (58)

55 contract CSVs + `manifest.json`, plus:

- `core_0_tracing_report_0.json` (Chrome Trace — timeline)
- `aicore_utilization.json`

Performance-hint CSVs in the pack: `HintMessages.csv`, `HintTypes.csv`, `InstructionHints.csv`, `KernelHints.csv`, `SourceLineHints.csv`.

Heat CSVs added 2026-10-29 for playground / unit smoke of the Layout+Cells path: `MemoryHeatmapLayout.csv`, `MemoryHeatmapCells.csv`.

Mem util CounterTrack pipes injected 2026-11-18 into `core_0_tracing_report_0.json` (populated `*_UB/L0*/L1_UTILIZATION` + `memory_utilization` `ph:C`, with `Using Bytes (KB)`) for playground / #208 smoke.
