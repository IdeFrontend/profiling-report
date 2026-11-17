# `RooflineBandwidthPeaks.csv`

| | |
|--|--|
| **Contract object** | `RooflineBandwidthPeaks` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |
| **View** | [roofline](../../views/roofline.md) |
| **Decision** | [DATA-57a](../../context/decisions/interim/DATA.md#data-57a) |

| | |
|--|--|
| Kind | table |
| Role | Full-chip memory-bandwidth ceilings per unit × memory level (GiB/s). |

| Column | Type | Description |
|--------|------|-------------|
| `Unit` | `TEXT` | `AIV` or `AIC`. |
| `MemoryLevel` | `TEXT` | Same identifiers as `RooflinePoints.MemoryLevel`. |
| `PeakGBs` | `REAL` | Bandwidth ceiling (GiB/s). Join with compute peaks by `Unit` for HTML-matching roofs. |
