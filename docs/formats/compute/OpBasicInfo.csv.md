# `OpBasicInfo.csv`

## UI / sample notes

Operator-level (one row per profiled OP in the sample).

| Column | Sample presence | Docx UI use |
| --- | --- | --- |
| `Op Name` | yes | Kernel / OP identity |
| `Op Type` | yes | 算子类型 (`OpType`); MIX triggers Cube/Vector pipe split |
| `Task Duration(us)` | yes | 整体耗时 |
| `Block Dim` | yes | Blocks |
| `Mix Block Dim` | yes | — |
| `Device Id` | yes | — |
| `Pid` | yes | 进程ID (aside meta **进程**) |
| `Current Freq` | yes | Hardware overlay / OpBasicInfo dump; **not** on the v930 header. Also feeds **CPU clocks** display — derived `cycles = ns × freqMHz / 1000` with Current when valid, else Rated ([UI-45](../../context/decisions/UI.md)); not `HardwareInfo.jsonl` `ai_core_frequency_MHZ` |
| `Rated Freq` | yes | Same as Current Freq — not on the aside shell; fallback MHz for derived cycles ([UI-45](../../context/decisions/UI.md)) |

## Schema

One row per operator. §11.1.3.8.7.

| Column | Meaning |
| --- | --- |
| `Op Name` | Operator name. |
| `Op Type` | Operator type. |
| `Task Duration(us)` | Task duration in microseconds: schedule onto the AI processor, execute, and completion response. |
| `Block Dim` | Task split count; the logical core count the developer set. |
| `Mix Block Dim` | Vector-core count when the operator runs on Cube and Vector together. `Block Dim` is then the Cube count. `N/A` means not a Mix operator. PDF limits this to Atlas A3 train/infer, Atlas A2 train/infer, and Ascend 950. |
| `Device ID` | AI processor id at runtime. The classic sample header spells this `Device Id`. |
| `PID` | Process id. The classic sample header spells this `Pid`. |
| `Current Freq` | Current AI processor frequency. |
| `Rated Freq` | Rated AI processor frequency. |
