# `roofline.json`

| | |
|--|--|
| **Profile** | `emulate` |
| **Role** | Debug export of the Roofline analyzer snapshot |
| **Decision** | [DATA-57a](../../context/decisions/interim/DATA.md#data-57a) |

Fallback when `RooflinePoints.csv` / `RooflineComputePeaks.csv` / `RooflineBandwidthPeaks.csv` are absent. When both CSV and JSON are packed, **CSV wins**. Field renames (`performance`, `arithmetic_intensity`, `peakFlops`, `peakBandwidth*`) must not redefine units — see producer `roofline_data_format.md` § Debug-export naming.

## Shape

```json
{
  "architecture": {
    "AIV": { "vector_fp16": { "peakFlops": 54000, "peakBandwidthSIMD": 50353.92 } },
    "AIC": { "cube_fp16_bf16": { "peakFlops": 432000, "peakBandwidthL0": 50353.92 } }
  },
  "kernels": {
    "fn - SIMD": {
      "pc": 1024,
      "unit": "AIV",
      "label": "SIMD",
      "arithmetic_intensity": 0.125,
      "performance": 6.66
    }
  }
}
```
