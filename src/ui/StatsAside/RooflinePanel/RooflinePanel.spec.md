# RooflinePanel

| spec-id-prefix |
|----------------|
| PR-ROOF-*      |

Log-log roofline bottleneck chart (M2 interim DATA-37*).

## Inputs

**model** is a `RooflineViewModel` (`points`, `mixLabels`, `peakComputeTops`, `peakBandwidthGBs`). Optional **locale** for title/legend.

## Behavior

Renders a log-log SVG: X = Ops/Byte, Y = TOps/s. Draws the theoretical roof (`min(peakCompute, peakBW_GBs * intensity / 1000)`), measured points (solid/hollow), and op-mix labels. Hover on a point shows intensity + performance. Parent hides the panel when there are no points — empty `points` renders an empty root (no chart chrome).

Tabs (内存单元 / 通路 / 搬运) are omitted (DATA-37f).

## Acceptance Criteria

1. **PR-ROOF-001** — Renders chart with at least one point and roof path.
2. **PR-ROOF-001b** — Raised chart card includes under-roof `#3078f0` gradient wash.
3. **PR-ROOF-002** — Shows mix labels when present.
4. **PR-ROOF-002b** — Sketch-calibrated layout via `rooflineLayout.ts`: chart **440×303** @ **480px** aside; scaled `PAD.l` **47**; mix at plot top; **TOps/s** / **Ops/Byte** grid-aligned with gaps; markers not clipped; SVG display width tracks the card (`width: 100%`).
5. **PR-ROOF-003** — Empty points → no chart SVG.
6. **PR-ROOF-004** — Hover point exposes tooltip text with intensity and performance **inside the raised card** below the chart; tip slot is always reserved so the card does not shift on hover.

## Visual

Normative crop: [`visual/roofline.png`](./visual/roofline.png) — [`visual/provenance.yaml`](./visual/provenance.yaml). Cross-check raised card + under-roof wash against [`v930/detail-strip-raised`](../../../../docs/ui/source/v930/detail-strip-raised.jpeg). Tabs in the crop are **omitted** (DATA-37f).

| Token | Value |
|-------|--------|
| Title | `13px` / `600` / `#ffffff` — Roofline 瓶颈分析 (outside the raised card, on aside) |
| Raised card | Uniform `#262626` for header + plot + tick gutters; `8px` radius; soft inset top highlight (no outer border) |
| Chart title | `GM/L2` `12px` / `600` / `#ffffff` (card header left) |
| Plot well | `#262626` (same as card) |
| Legend | `11px` / `#9a9a9a` |
| Roof / points | `#3078f0`; roof stroke `2px`; hollow vertex markers on roof polyline |
| Area wash | Vertical `#3078f0` under ridge: 16% → 10% @40% → 5% @75% → 0% at floor |
| Mix annotation | Two-tone at plot top: names `#999999`, percents `#ffffff`, `10px`; `label (percent.toFixed(6)%)`, comma-separated; baseline `y = PAD.t + 13` |
| Axis / ticks | `#999999` `9px`; ticks as decimals; x ticks at `plotBottom + 16`; y ticks at tick line `+ 4`; **TOps/s** end-anchored at left grid (`x = PAD.l`, hanging, bottom `12px` above plot top); **Ops/Byte** start-anchored `4px` right of plot on bottom grid line (`x = PAD.l + plotW + 4`, `y = plotBottom`, middle baseline) |
| Chart SVG | Intrinsic **`440×303`** viewBox @ **480px** aside (`aside − 24 shell pad − 16 card pad`; height scales from sketch **`320×220`**); CSS `width: 100%` so a scrollbar gutter cannot force horizontal overflow |
| Plot inset | `PAD` `{ l: 47, r: 66, t: 28, b: 50 }` — sketch `{34,48,20,36}` scaled by `440/320`; plot frame has no stroke (sketch flat well) |
| Header→plot | Card `gap` **8px** (`6px` under GM/L2 before SVG/plot); SVG top pad `PAD.t` **27** |
| Grid | `#4a5568` (blue-grey; visible on `#262626` well) |
| Markers | Data + roof vertex circles render **outside** plot clip so edge markers are not cropped |

## Dependencies

[view-models](../../../../specs/core/view-models.spec.md), DATA-37a–f, [VIEW_DATA_MAPPING §11.2.4](../../../../docs/ui/VIEW_DATA_MAPPING.md).

## Changelog

- **2026-09-02** — Chart SVG uses `width: 100%` (viewBox stays **440×303**) so aside scroll never needs a horizontal bar.
- **2026-09-02** — Aside **480px** (Product); chart **440×303** from content well.
- **2026-09-01** — Hover tooltip inside raised card; reserved tip slot prevents layout jump.
- **2026-09-01** — Fixed aside **468px** (v930 sketch); chart **428×294** scales from sketch **320×220** baseline.
- **2026-09-01** — Card head→plot `gap` 8px (+6 under GM/L2).
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
- **2026-08-13** — Crop token table; tabs remain omitted (DATA-37f).
- **2026-08-10** — Initial M2 interim panel.
