# `RooflinePoints.csv`

| | |
|--|--|
| **Contract object** | `RooflinePoints` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |
| **View** | [roofline](../../views/roofline.md) |
| **Decision** | [DATA-57a](../../context/decisions/interim/DATA.md#data-57a) |

| | |
|--|--|
| Kind | table |
| Role | One function/mode/memory-level measured roofline point (npu-simulator Roofline analyzer). |

| Column | Type | Description |
|--------|------|-------------|
| `FunctionPC` | `INTEGER` | Function entry (launch-relative bytes). |
| `FunctionSize` | `INTEGER` | Function size in bytes. |
| `FunctionName` | `TEXT` | Symbol name (may be mangled). |
| `ExecutionMode` | `TEXT` | `SIMD`, `SIMT`, or `CUBE`. |
| `Unit` | `TEXT` | `AIV` or `AIC`. |
| `MemoryLevel` | `TEXT` | `SIMD-UB` / `SIMT-UB` / `SIMT-OUT` / `CUBE-L0` / `CUBE-OUT`. |
| `ExecutionCount` | `INTEGER` | Attributed call count (CUBE uses `1`). |
| `DurationTicks` | `INTEGER` | Duration in simulator ticks. |
| `FpOperations` | `INTEGER` | Weighted FP work. |
| `IntegerOperations` | `INTEGER` | Weighted integer work. |
| `TotalOperations` | `INTEGER` | `FpOperations + IntegerOperations` (X/Y numerator). |
| `ProcessedBytes` | `INTEGER` | Byte total for this memory level. |
| `ArithmeticIntensity` | `REAL` | Ops/Byte (chart X). |
| `ThroughputGBs` | `REAL` | GiB/s (`B / 1024³ / seconds`). |
| `PerformanceGFlops` | `REAL` | GOPS (chart Y before `/1000` → TOps/s). |
