# gather_2d Source-tab sample

From `sample [cTiIlO].zip` (npu-compute gather_2d / SIMT).

**Format SSOT:** [compute/FORMAT.md](../../docs/formats/compute/FORMAT.md) · view packet [source](../../docs/views/source.md).

| Artifact | Role |
|---|---|
| `gather_2d.asc` | Ascend C SIMT source (zip root; not in producer `out.npu-rep`) — matching rules in [symbolizer.json.md#source-text](../../docs/formats/compute/symbolizer.json.md#source-text) |
| [`objdump.txt`](../../docs/formats/compute/objdump.txt.md) | Disassembly → SASS pane (`llvm-objdump`) |
| [`symbolizer.json`](../../docs/formats/compute/symbolizer.json.md) | PC → file/function/line (`llvm-symbolizer` JSON) |
| [`summary.db`](../../docs/formats/compute/summary.db.md) | SQLite [`pc_sampling`](../../docs/formats/compute/summary.db.md#pc_sampling) stall counters by `pc_offset` (some packs use [`PcSampling`](../../docs/formats/compute/summary.db.md#PcSampling); reader accepts either) |
| `out.npu-rep` | Producer leaf as shipped (embeds above **except** `.asc`) |

Playground fixture **`data/gather_2d.npu-rep`** is the same leaf **plus** `gather_2d.asc` so Source can open without a separate source fetch (`?fixture=gather_2d`).

Product doc (`npu-compute性能优化` §11.4): Source columns include Instruction executed / time, sampling stall (+ reasons), warp occupancy, cache line, live register, branch efficiency — only stall counters ship in this pack today ([DATA-55](../../docs/context/questions/DATA.md)).
