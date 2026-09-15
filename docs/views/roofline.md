# Roofline

| | |
|--|--|
| **Id** | `roofline` |
| **Panel / component** | `RooflinePanel` → `src/ui/StatsAside/RooflinePanel/` |
| **Capability** | `roofline` |
| **Phase** | M2 |
| **Unification** | `gap` (emulate — same panel, different mapper) |
| **Sept 30 (emulate)** | **hide** |

## Sketches

![Detail strip / raised cards](../ui/source/v930/detail-strip-raised.jpeg)

**Component crop:** ![Roofline](../../src/ui/StatsAside/RooflinePanel/visual/roofline.png)

## Purpose

Log-log intensity vs achieved performance chart with theoretical roof and optional op-mix labels.

## View-model

| Field | Role | Required? |
|-------|------|-----------|
| `reportModel.roofline.points[]` | Measured points | **Required to show** |
| `roofline.mixLabels` / peaks | Mix + ceilings | Optional |
| capability `roofline` | Host/feature gate | Set when points exist |

## Hide rule

No usable GM point → hide panel ([DATA-30](../context/decisions/DATA.md)). Tabs 内存单元/通路/搬运 omitted until DATA-37 (DATA-37f).

## Compute fill

| Adapted field | Embed | Columns / notes | Schema SSOT |
|---------------|-------|-----------------|-------------|
| `roofline` | `ArithmeticUtilization.csv` + `Memory.csv` | Interim DATA-37a–e GM point | [METRICS](../formats/compute/METRICS_AND_TRACE.md), [view-models](../../specs/core/view-models.spec.md) |

## Emulate fill

| Adapted field | Embed | Columns / notes | Status |
|---------------|-------|-----------------|--------|
| `roofline` | ArchDiagramMetrics + ExecutedInstructions + VectorUtilizations ± ELF Functions/SourceInstructions | New mapper required; not Arithmetic+Memory | `gap` → hide Sept 30 |

Do **not** invent compute Arithmetic/Memory CSVs ([DATA-45](../context/decisions/DATA.md)).

## Adapter

| Profile | Entry | Notes |
|---------|-------|-------|
| compute | `rooflineFromCsv` in `adaptPayloads` | |
| emulate | — | Post–Sept 30 slice |

## Related

- Spec: [RooflinePanel.spec.md](../../src/ui/StatsAside/RooflinePanel/RooflinePanel.spec.md)
- Product docx §: 11.2.4 / emulate 11.2.3.5
- Open: [DATA-37](../context/questions/DATA.md)
