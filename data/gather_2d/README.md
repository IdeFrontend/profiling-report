# gather_2d Source-tab sample

From `sample [cTiIlO].zip` (npu-compute gather_2d / SIMT).

| Artifact | Role |
|---|---|
| `gather_2d.asc` | Ascend C SIMT source (zip root; not in producer `out.npu-rep`) |
| `objdump.txt` | Disassembly → SASS pane (`llvm-objdump`) |
| `symbolizer.json` | PC → file/function/line (`llvm-symbolizer` JSON) |
| `summary.db` | SQLite `pc_sampling` stall counters by `pc_offset` |
| `out.npu-rep` | Producer leaf as shipped (embeds above **except** `.asc`) |

Playground fixture **`data/gather_2d.npu-rep`** is the same leaf **plus** `gather_2d.asc` so Source can open without a separate source fetch (`?fixture=gather_2d`).

Product doc (`npu-compute性能优化` §11.4): Source columns include Instruction executed / time, sampling stall (+ reasons), warp occupancy, cache line, live register, branch efficiency — only stall counters ship in this pack today ([DATA-55](../../docs/context/questions/DATA.md)).
