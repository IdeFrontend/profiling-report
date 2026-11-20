# `RooflineComputePeaks.csv`

| | |
|--|--|
| **Contract object** | `RooflineComputePeaks` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |
| **View** | [roofline](../../views/roofline.md) |
| **Decision** | [DATA-57a](../../context/decisions/interim/DATA.md#data-57a) |

| | |
|--|--|
| Kind | table |
| Role | Full-chip compute reference ceilings (`PeakGFlops` in BiProf GOPS). |

| Column | Type | Description |
|--------|------|-------------|
| `Unit` | `TEXT` | `AIV` or `AIC`. |
| `DataType` | `TEXT` | AIV: `fp16` / `bf16` / `fp32`. AIC: `fp16_bf16` / `tf32_hf32` / `fp32` / `int8_fp8`. |
| `PeakGFlops` | `REAL` | Full-chip compute peak (GOPS); viewer `/1000` → TOps/s. Not scaled by active cores. |
