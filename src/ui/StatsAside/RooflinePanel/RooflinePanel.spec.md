# RooflinePanel

| spec-id-prefix |
|----------------|
| PR-ROOF-*      |

Log-log roofline bottleneck chart (M2 interim I-Q11*).

## Inputs

**model** is a `RooflineViewModel` (`points`, `mixLabels`, `peakComputeTops`, `peakBandwidthGBs`). Optional **locale** for title/legend.

## Behavior

Renders a log-log SVG: X = Ops/Byte, Y = TOps/s. Draws the theoretical roof (`min(peakCompute, peakBW_GBs * intensity / 1000)`), measured points (solid/hollow), and op-mix labels. Hover on a point shows intensity + performance. Parent hides the panel when there are no points — empty `points` renders an empty root (no chart chrome).

Tabs (内存单元 / 通路 / 搬运) are omitted (I-Q11f).

## Acceptance Criteria

1. **PR-ROOF-001** — Renders chart with at least one point and roof path.
2. **PR-ROOF-002** — Shows mix labels when present.
3. **PR-ROOF-003** — Empty points → no chart SVG.
4. **PR-ROOF-004** — Hover point exposes tooltip text with intensity and performance.

## Visual

Normative crop: [`visual/roofline.png`](./visual/roofline.png) — [`visual/provenance.yaml`](./visual/provenance.yaml). Tabs in the crop are **omitted** (I-Q11f).

| Token | Value |
|-------|--------|
| Title | `13px` / `600` — Roofline 瓶颈分析 |
| Roof / points | `#3a8cff` |
| Mix annotation | `#c8d0d8` `8px` |
| Grid | `#3a424a` |

## Dependencies

[view-models](../../../../specs/core/view-models.spec.md), I-Q11a–f, [VIEW_DATA_MAPPING §11.2.4](../../../../docs/ui/VIEW_DATA_MAPPING.md).

## Changelog

- **2026-08-13** — Crop token table; tabs remain omitted (I-Q11f).
- **2026-08-10** — Initial M2 interim panel.
