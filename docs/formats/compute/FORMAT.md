# Compute profile — data sections

**Profile:** `compute` (npu-compute / device OP profiling).

Flat list of leaf embeds (one markdown file per pack section). File name is `{section}.md` — strip `.md` to get the exact FileInfo / payload basename.

Shared container: [formats README](../README.md). Emulate: [../emulate/FORMAT.md](../emulate/FORMAT.md).
Producer field catalog notes: [SCHEMA.md](SCHEMA.md). UI fill crosswalk: [METRICS_AND_TRACE.md](METRICS_AND_TRACE.md). View packets: [../../views/](../../views/).

## Sections

| Section |
|---------|
| [`ArithmeticUtilization.csv`](ArithmeticUtilization.csv.md) |
| [`HardwareInfo.jsonl`](HardwareInfo.jsonl.md) |
| [`L2Cache.csv`](L2Cache.csv.md) |
| [`Memory.csv`](Memory.csv.md) |
| [`MemoryL0.csv`](MemoryL0.csv.md) |
| [`MemoryL1.csv`](MemoryL1.csv.md) |
| [`MemoryUB.csv`](MemoryUB.csv.md) |
| [`objdump.txt`](objdump.txt.md) |
| [`OpBasicInfo.csv`](OpBasicInfo.csv.md) |
| [`PipeTrace.json`](PipeTrace.json.md) |
| [`PipeUtilization.csv`](PipeUtilization.csv.md) |
| [`ResourceConflictRatio.csv`](ResourceConflictRatio.csv.md) |
| [`Sampling.json`](Sampling.json.md) |
| [`summary.db`](summary.db.md) |
| [`summary.jsonl`](summary.jsonl.md) |
| [`symbolizer.json`](symbolizer.json.md) |
| [`trace.json`](trace.json.md) |

## Notes

- Optional Ascend C / C++ source text embeds (`.asc` / `.cpp` / `.h`) have **variable** basenames; matching rules live under [`symbolizer.json.md`](symbolizer.json.md#source-text).
- Nested SQLite tables `pc_sampling` / `PcSampling` are specified **inside** [`summary.db.md`](summary.db.md), not as separate files.
- Lookup accepts `Summary.jsonl` / `SUMMARY.jsonl` as the same embed; only [`summary.jsonl.md`](summary.jsonl.md) is kept.
