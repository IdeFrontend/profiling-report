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
2. **PR-ROOF-001b** — Raised chart card includes under-roof `#3078f0` gradient wash.
3. **PR-ROOF-002** — Shows mix labels when present.
4. **PR-ROOF-002b** — Sketch-calibrated label positions and left inset (`PAD.l` 34; mix at plot top; Ops/Byte bottom-right; TOps/s above top tick).
5. **PR-ROOF-003** — Empty points → no chart SVG.
6. **PR-ROOF-004** — Hover point exposes tooltip text with intensity and performance.

## Visual

Normative crop: [`visual/roofline.png`](./visual/roofline.png) — [`visual/provenance.yaml`](./visual/provenance.yaml). Cross-check raised card + under-roof wash against [`v930/detail-strip-raised`](../../../../docs/ui/source/v930/detail-strip-raised.jpeg). Tabs in the crop are **omitted** (I-Q11f).

| Token | Value |
|-------|--------|
| Title | `13px` / `600` / `#ffffff` — Roofline 瓶颈分析 (outside the raised card, on aside) |
| Raised card | Uniform `#262626` for header + plot + tick gutters; `8px` radius; soft inset top highlight (no outer border) |
| Chart title | `GM/L2` `12px` / `600` / `#ffffff` (card header left) |
| Plot well | `#262626` (same as card) |
| Legend | `11px` / `#9a9a9a` |
| Roof / points | `#3078f0`; roof stroke `2px`; hollow vertex markers on roof polyline |
| Area wash | Vertical `#3078f0` under ridge: 16% → 10% @40% → 5% @75% → 0% at floor |
| Mix annotation | Two-tone at plot top: names `#999999`, percents `#ffffff`, `10px`; `label (percent.toFixed(6)%)`, comma-separated; baseline `y = PAD.t + 10` |
| Axis / ticks | `#999999` `9px`; ticks as decimals (`0.0001`…`0.1`); **TOps/s** end-anchored above the `10` tick (`y = PAD.t − 12`, left gutter `x = PAD.l − 4`); **Ops/Byte** end-anchored inside bottom-right (`x = PAD.l + plotW × 0.885`, `y = PAD.t + plotH − 5`) |
| Plot inset | `PAD` `{ l: 34, r: 10, t: 14, b: 36 }`; plot frame has no stroke (sketch flat well) |
| Header→plot | Tight: card `gap` `2px`, SVG top pad `14` (plot frame close under GM/L2) |
| Grid | `#343434` |

## Dependencies

[view-models](../../../../specs/core/view-models.spec.md), I-Q11a–f, [VIEW_DATA_MAPPING §11.2.4](../../../../docs/ui/VIEW_DATA_MAPPING.md).

## Changelog

- **2026-08-31** — Mix labels anchored to plot top (`PAD.t + 10`), not mid-plot sketch band.
- **2026-08-31** — Sketch pixel pass: `PAD.l` 34; Ops/Byte 11.5% from right; frame stroke off.
- **2026-08-27** — TOps/s above top y-tick (left gutter), mirroring Ops/Byte on `100`.
- **2026-08-27** — Layout: tighter GM/L2→plot gap (`PAD.t` 14, card gap 2); Ops/Byte centered on `100` tick.
- **2026-08-27** — Whole raised card uniform `#262626` (header + plot + gutters); title outside on aside.
- **2026-08-27** — SVG/tick-gutter bg `#262626` (sketch grey around plot, not card `#161616`).
- **2026-08-27** — Pixel pass: outer well `#1a1a1a`, card `#161616`, mix two-tone (`#999` / `#fff`), Ops/Byte in axis gutter.
- **2026-08-27** — Labels: decimal ticks, Ops/Byte inside plot; card chrome `#1a1a1a` (sketch header mode).
- **2026-08-27** — Sketch pixel pass: GM/L2 header, roof vertex markers, mix `toFixed(6)`, softer ridge-anchored wash.
- **2026-08-26** — Re-tuned gradient (ridge-anchored alpha curve) + chart type sizes from detail-strip-raised samples; raised card `#161616`.
- **2026-08-26** — Raised chart card + under-roof accent gradient (detail-strip-raised / report-stats); roof accent `#3078f0`.
- **2026-08-13** — Crop token table; tabs remain omitted (I-Q11f).
- **2026-08-10** — Initial M2 interim panel.
