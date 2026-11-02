# MemoryHeatmapPanel

| spec-id-prefix |
|----------------|
| PR-HEAT-*      |

biprof **§11.2.3.2 Memory Utilization Heatmap** — the right-hand panel of the memory-topology **全屏** overlay. Its own surface beside [`MemoryTopologyPanel`](../MemoryTopologyPanel/MemoryTopologyPanel.spec.md): the diagram shows the path, this panel shows one unit's allocation (DATA-49).

## Inputs

**Data SSOT:** [docs/views/memory-topology.md § Memory Utilization Heatmap](../../../../docs/views/memory-topology.md).
**Carrier:** `MemoryHeatmapModel` ([`src/domain/types.ts`](../../../domain/types.ts)) — `units: { id, views[] }[]`; each view carries Layout lattice + capacity; **capability `memoryHeatmap`**, independent of `memoryDiagram` / `archDiagram`.
**Builder:** [`emulateMemoryHeatmap.ts`](../../../adapters/emulateMemoryHeatmap.ts) (`memoryHeatmapFromTexts`) — Layout+Cells only ([DATA-50](../../../../docs/context/decisions/DATA.md)); wired in [`adaptEmulate`](../../../adapters/adaptEmulate.ts) / compute path. No UbRw path.

**model** — optional `MemoryHeatmapModel` (`units[].views[]`). **selectedUnit** — host-owned tab. Multi-view units (AIV0/AIV1 UB) keep a **local** view selector (PR-HEAT-012) — same `SourcePillSelect` chrome as the Source tab. Optional **locale**.

**Filled by:** one view per Layout row — lattice cols/rows from `Width`×`Height`, capacity from [DATA-51](../../../../docs/context/decisions/DATA.md); `OutsideDeclared` badge. Missing units blank ([UI-60](../../../../docs/context/decisions/UI.md) — no L2Cache tab).

## Outputs

**select-unit** — a tab click names the unit the host should show; the host writes it back as **selectedUnit**, so the tab strip, the diagram's selected unit and the panel body cannot disagree (PR-MEMTOP-022).

## Behavior

1. **Five tabs, always** (PR-HEAT-001): `L1 | UB | L0A | L0B | L0C` ([UI-60](../../../../docs/context/decisions/UI.md) — no L2Cache), in that order, `role="tablist"` / `role="tab"` with `aria-selected` and a **roving tabindex** (only the selected tab is in the tab order; Arrow / Home / End move the selection — PR-HEAT-009). A unit the model has no source for is **not** omitted — the tab stays and its body blanks (behavior 5), because the strip is a fixed five.
2. **Legend** (PR-HEAT-002): the two states the grid can paint, `已分配有数据` / `已分配无数据`, each with its swatch. The blues are normative — see Visual.
3. **Body** (PR-HEAT-003): the **block grid** — one cell per active `view.blocks` entry, row-major, `view.columns` × `view.rows` (Layout `Width`×`Height`) square cells, sized to fit the leftover body (PR-HEAT-011) — then the selected view's name (behavior 5) and the capacity caption **under** it. A cell is `withData` (dark blue) or `withoutData` (light blue) — the same two states as the legend, never a third, and never a divider band. Column and row counts bind from the active view (not restated in CSS). The frame repeats the view's **name** under its grid (Visual), so the body carries it there — never a second copy *above* the lattice. The five tabs share **one** `role="tabpanel"` body, named by the active tab.
4. **Metric** (PR-HEAT-004 / PR-HEAT-004b): centred **below** the grid (under the unit name). Paint `Total: {n} / Used: {n} / Free: {n}` from the active view's capacity fields ([DATA-51](../../../../docs/context/decisions/DATA.md)). Omit when Total is unknown — never a placeholder, never `已用指令条数`.
5. **Unit name** (PR-HEAT-010): the selected view (`{ownerName} {memoryName}` when known, else the diagram's tab words), centred between the grid and the metric at `19px` `#e7e7e7`, `31px` under the grid. Absent with the blank body (behavior 6) — no name without a grid.
6. **Blank state** (PR-HEAT-005): a tab whose unit is absent from `model.units` shows the empty line and no grid; it does **not** show an all-empty grid, which would read as "measured, nothing allocated" rather than "no source".
7. **Selection is the host's** (PR-HEAT-006): the active tab is `selectedUnit`; a click emits **select-unit** and changes nothing else. Re-clicking the active tab emits again — the host treats it as a no-op (PR-MEMTOP-023).
8. **Omit itself** (PR-HEAT-007): with no `model`, or a model with no units, the panel renders nothing at all (no tab strip, no legend). The host also gates the mount on the capability, so this is the second guard, not the first.
9. **Grid a11y** (PR-HEAT-008): the grid is one `role="img"` with a label summarising `{used} / {total}` allocated blocks, i.e. the cells are not read out one by one — 416 anonymous cells are noise, and the counts are what the picture says.
10. **Short column fit** (PR-HEAT-011): the tab strip, legend, view-bar band, unit name and metric keep their frame sizes; the body is the size container and the grid picks a square cell = `min(width-fit, height-fit)` (height budget minus the title/metric footer) so the Layout lattice never overflows and **never opens a scrollbar**. Spare height falls below the metric. The body clips (`overflow: hidden`).

## Acceptance Criteria

1. **PR-HEAT-001** — Renders the five tabs in order (`L1`, `UB`, `L0A`, `L0B`, `L0C`) as `role="tab"` buttons inside a `role="tablist"`, all five present even when `model.units` carries fewer (a unit with no source keeps its tab). No `L2Cache` tab ([UI-60](../../../../docs/context/decisions/UI.md)).
2. **PR-HEAT-002** — Renders the two-state legend with `已分配有数据` on `#3d64ad` and `已分配无数据` on `#afc6fe`, `8px` swatches, the pair centred in the column.
3. **PR-HEAT-003** — Renders one grid cell per active `view.blocks` entry in carrier order with `data-state="withData" | "withoutData"`, `#3d64ad` / `#afc6fe` respectively, `view.columns` per row, and no third state. The grid is one `2px` `#6e798d` frame around a `#303f5e` board with a `2px` inset and `2px` gaps — no per-cell divider band.
4. **PR-HEAT-004 / PR-HEAT-004b** — With `totalBytes`/`usedBytes`/`freeBytes` on the active view, shows `Total: {n} / Used: {n} / Free: {n}` and binds `--pr-heat-cols` / `--pr-heat-rows` from that view. Omits the caption when Total is unknown. No instruction-count metric.
5. **PR-HEAT-005** — A selected unit absent from the model shows the empty line and **no** grid.
6. **PR-HEAT-006** — The tab named by `selectedUnit` is the only `aria-selected="true"` tab; a click on any tab emits `select-unit` with that unit and does not change the rendered selection by itself.
7. **PR-HEAT-007** — Renders nothing when `model` is null/undefined or has no units.
8. **PR-HEAT-008** — The grid is a single `role="img"` whose accessible name reports `{used} / {total}` allocated blocks, and its cells are not individually exposed.
9. **PR-HEAT-009** — The strip is a complete `tablist`: exactly one tab has `tabindex="0"` (the selected one, the rest `-1`; with no selected unit the **first** tab carries it, so the strip is never unreachable by keyboard), `ArrowRight` / `ArrowLeft` move the selection to the next / previous unit and **wrap** at both ends, `Home` / `End` jump to the first / last unit, any other key is left to the platform, and the click handler is unchanged — the tab click and the arrow keys both emit **select-unit** and the panel never moves the selection itself. The five tabs share one `role="tabpanel"` body, `aria-labelledby` the selected tab. The labels fill the column to the pixel, so the tabs never shrink or wrap: each keeps its own width and the strip scrolls horizontally instead (invisible while they fit).
10. **PR-HEAT-010** — With a drawable unit, the body's text content is exactly two lines in this order: the unit's diagram name (`AIV × 2 UB`, `19px` `#e7e7e7`, centred) then the metric; the name is absent (with the grid) for a blank unit, and no unit name is rendered **above** the grid.
11. **PR-HEAT-011** — The body is the size container (`container-type: size`); the grid picks `--pr-heat-cell: min(width-fit, height-fit)` with a footer budget for title + metric. Height-fit subtracts the same **8px** frame (padding+border) as width-fit so the `#6e798d` stroke is not clipped. The body has `overflow: hidden` (no scrollbar). Tabs, legend, the always-reserved view-bar band, and the `OutsideDeclared` badge stay outside the body so they cannot clip the lattice. The grid binds both `--pr-heat-cols` and `--pr-heat-rows`, and its frame is `5px`-rounded.
12. **PR-HEAT-012** — When the active unit has more than one view (multi-core UB), a `SourcePillSelect` in the reserved view-bar band switches the lattice / name / capacity among those views. Single-view tabs keep the empty band (same lattice height) and mount no select.

## Visual

Dark-only: panel `#262626` (the topology card's surface, not `--pr-bg-panel`), tab strip ruled on `#333333`, active tab on the short white bar. The panel is mounted as the 全屏 overlay's right column (**400px**, the sketch's ~398px band) and meets the diagram with **no** stroke between them — the frame's own boundary is the panel's `#262626` against the overlay's literal `#1a1a1a` (not `--pr-bg-aside`, which light-theme remaps), not a divider line. Every value below is measured off the sketch crop (`visual/heat-panel.png`, a 1:1 crop of the 7680×4320 frame, i.e. **4×** — so sketch px ÷ 4 = frame px).

Shipped block order: tab strip → rule → legend → **reserved view-bar** (multi-view pill or empty band, PR-HEAT-012) → optional `OutsideDeclared` badge → body (`grid` → selected view name → `Total / Used / Free` caption). Nothing sits *above* the lattice inside the body except the grid itself.

| Token | Value |
|-------|-------|
| Panel bg | `#262626`, `8px` radius (1030 fullscreen — same corner as the zoom pill) |
| Tab text / legend text | `#b3b3b3`, `#fff` when active |
| Active tab indicator | `#ffffff`, `2px` tall, the label + 4px wide (the frame's 15px bar under an 11.5px `L1`), `12px` under the label and `12px` above the strip's rule (sketch ~12.5px) |
| Tab strip rule | `#333333` `1px` across the panel's content width |
| Tab strip rhythm | label-to-label ink `26px` (the frame's `106px` at 4×), so the labels sit apart rather than as boxed chips |
| Legend | centred in the column; swatch `8px` (the frame's `32px` at 4× — the frame's own 12px type size), `1px` radius, `8px` to its label, `20px` between the two pairs |
| Legend offsets | swatch `47.5px` under the strip's rule; legend bottom pad `12px` into the view-bar band |
| View-bar | always reserved (`min-height` = Source pill `28px`); multi-view UB mounts `SourcePillSelect` |
| Unit name under the grid | active view (`{owner} {MemoryName}`), `19px`/`22px` line-height `#e7e7e7`, `600`, centred `31px` under the grid |
| Metric caption | `#b3b3b3`, `12px`/`15px` line-height, centred `13px` under the unit name — `Total: {n} / Used: {n} / Free: {n}` ([DATA-51](../../../../docs/context/decisions/DATA.md)); omitted when Total unknown |
| `已分配有数据` (allocated, with data) | `#3d64ad` |
| `已分配无数据` (allocated, no data) | `#afc6fe` |
| Grid frame | `2px` `#6e798d` border around the board, `5px` radius (sketch ~20px at 4×), one `2px` gap of inset inside it; cells clip to the radius |
| Grid board (the lattice the gaps cut) | `#303f5e` |
| Grid cell | `aspect-ratio: 1`, `2px` gap, `1px` radius |
| Grid size | square cell = `min(width-fit, height-fit)` against the body (`100cq*` minus the title/metric footer **and** 8px frame); cols/rows from Layout `Width`×`Height` |
| Short column | lattice resizes to fit; no body scrollbar (PR-HEAT-011). Spare height falls **below** the metric |
| Fullscreen ground | overlay `#1a1a1a`; diagram `.pr-topo` stays transparent. This panel and the fullscreen zoom pill both paint `#262626` |

The two blues and the board/frame greys are the frame's own, sampled from `v930-sim/memory-topology-fullscreen` (`#3D64AD` legend/block ink, `#AFC6FE` empty-block ink, `#303F5E` board, `#6E798D` frame) and registered in [COLOR_TOKENS § Heatmap](../../../../docs/ui/COLOR_TOKENS.md). The diagram's selected/hover tints are the two blues ([MemoryTopologyPanel](../MemoryTopologyPanel/MemoryTopologyPanel.spec.md) PR-MEMTOP-022), so the two surfaces read as one selection.

**Sketch deltas** (visual chrome vs Layout lattice): the biprof sketch shows a fixed ~16×32 lattice and a capacity tooltip under the name. The shipped panel keeps that chrome (colours, gaps, footer rhythm) but sizes the lattice from each Layout view's `Width`×`Height` ([DATA-50](../../../../docs/context/decisions/DATA.md)) and always paints the DATA-51 capacity caption when Total is known — never `已用指令条数`.

## Design sketches

- [heat-panel](./visual/heat-panel.png) — the overlay's right panel, from `v930-sim/memory-topology-fullscreen` (biprof §11.2.3.2) — [`visual/provenance.yaml`](./visual/provenance.yaml)
- [memory-topology-fullscreen](../../../../docs/ui/source/v930-sim/memory-topology-fullscreen.jpeg) — full frame: diagram left, heat panel right
- [memory-topology-zoom](../../../../docs/ui/source/v930-sim/memory-topology-zoom.jpeg) — the stacked aside the units are clicked in

## Dependencies

[DATA-49](../../../../docs/context/decisions/DATA.md) (its own surface), [DATA-50](../../../../docs/context/decisions/DATA.md) / [DATA-51](../../../../docs/context/decisions/DATA.md) (Layout+Cells lattice + capacity), [UI-60](../../../../docs/context/decisions/UI.md) (no L2Cache heat tab), [memory-topology](../../../../docs/views/memory-topology.md), [MemoryTopologyPanel](../MemoryTopologyPanel/MemoryTopologyPanel.spec.md), [emulate FORMAT](../../../../docs/formats/emulate/FORMAT.md), [ADAPTERS](../../../../docs/formats/ADAPTERS.md).

## Changelog

- **2026-11-02** — Align co-located spec with Layout+Cells only: `views[]`, capacity caption, Layout-driven cols/rows; drop UbRw / `已用指令条数` requirements; rewrite § Visual / Known deltas for view-bar + DATA-51 caption.
- **2026-11-02** — Drop L2Cache tab ([UI-60](../../../../docs/context/decisions/UI.md)): strip is five tabs `L1 | UB | L0A | L0B | L0C`.
- **2026-10-21** — Heat card `border-radius: 8px` (same as the fullscreen zoom pill; ~25px at 4× on the 1030 sketch). Fullscreen ground: diagram `.pr-topo` stays transparent; this panel and the zoom pill both paint `#262626`.
- **2026-10-09** — Title/metric line-heights (`22px` / `15px`) lock the `--pr-heat-footer: 81px` budget under height-fit; overlay ground called out as literal `#1a1a1a` (not `--pr-bg-aside`).
- **2026-10-08** — Pixel re-compare to `v930-sim/memory-topology-fullscreen`: heat column **400px** (sketch ~398), title gap **31px** (122px÷4), indicator **12px** above the rule, grid radius **5px**. Legend→map gap: body is the size container; spare height falls below the metric. Short-column fit (PR-HEAT-011); overlay ground `#1a1a1a`; diagram `.pr-topo` transparent in 全屏.
- **2026-10-06** — Short-column scroll (PR-HEAT-011, superseded 2026-10-08): the body was a vertical scrollport; replaced by lattice resize so sketch-faithful chrome stays put without a scrollbar.
- **2026-10-02** — Sketch re-verification, block order (4× crop): the frame draws the selected unit's **own name** under the grid (`AIC L1`, the diagram's words, `19px` `#e7e7e7`) and its `12px` caption line under that — both centred; above the grid only the legend, no title. The body now renders that name (new PR-HEAT-010) with the metric under it, so the metric moves from between the legend and the grid to the footer. The frame's `12px` caption is decoded as the **capacity tooltip** (`Total: 64KB` / `Used: 20KB` / `Free: 0KB`, green values) that [DATA-51](../../../../docs/context/questions/DATA.md) hides, so the metric takes that slot deliberately. Also corrected against the frame: the strip rule is `#333333`, there is **no** divider between the panel and the diagram (the frame's boundary is `#262626` against `#191919`), the swatch sits `47.5px` under the rule (not `45.5px`, so the legend's top padding is `44px`), and the grid `28px` under the swatch. PR-HEAT-003 / PR-HEAT-004 / PR-HEAT-010 and § Visual updated with it.
- **2026-10-02** — Sketch re-verification at the frame's true scale (`v930-sim/memory-topology-fullscreen` is 7680×4320, so `heat-panel.png` is 1:1 at **4×**: sketch px ÷ 4 = frame px). Three values were off and are corrected: the legend swatch is **8px** (the frame's 32px at 4×, not the `6px` that came from scaling by the panel width — the frame's column is 369px content, this one 295px, so panel-relative scaling under-measures fixed-size chrome); the legend's own rhythm is `8px` swatch→label and `20px` between the pairs (the frame's 30px / 75px at 4×); the tab strip's label-to-label ink is `26px` (the frame's 106px at 4×) — the buttons keep `10px` side padding for a 24px target and take the rhythm from the `6px` gap. The indicator's own geometry was already right (label + 4px, `2px` tall, `12px` under the label) but its distance above the rule was `8px` and is now `11px` (the frame's 43px at 4×). Everything else in § Visual re-measured equal at 4×: the `#303f5e` board with `9px`-at-4× gaps (the `2px` here), the `#6e798d` frame (11px at 4× against a 9px gap — nearer `2px` than `3px`), the white `L1` indicator over the `#333` rule, the centred legend (`±0.8px` of the column's centre) and 12px type.
- **2026-10-02** — Sketch verification (pixel comparison against `visual/heat-panel.png` at equal panel width): the grid is one **lattice** — a `2px` `#6e798d` frame around a `#303f5e` board with a gap of inset — instead of tiles on the panel bg; the invented per-cell divider band is gone (the frame has none — every gap is 8–10px, measured); the active tab carries a short **white** bar under its label rather than the heat blue across the whole tab, floating above the strip's rule; the legend is centred; the swatch is `6px`, the frame's ~2% of panel width. The grid is now sized by its rows so the frame wraps the lattice, and the panel keeps the column's leftover height below it. Remaining deltas (rows 26 vs the frame's 32, and the cell/inset proportions that follow from the block count) are recorded in § Visual and belong to DATA-50.
- **2026-10-01** — Review follow-up (PR-HEAT-009): the strip is now a complete `tablist` — roving tabindex plus Arrow / Home / End, and the six tabs share one `role="tabpanel"` named by the active tab (previously the roles were declared without the pattern behind them). The grid's column count is bound from `HEATMAP_COLUMNS` instead of restated as `repeat(16, 1fr)`.
- **2026-10-01** — Review follow-up: with no host selection the **first** tab carries `tabindex="0"`, so the strip cannot drop out of the tab order (the arrow handler already fell back to it); the labels fill the content box to the pixel, so the tabs no longer shrink or wrap and the strip scrolls horizontally instead.
- **2026-10-01** — Initial spec: §11.2.3.2 heat panel as the 全屏 overlay's right column — six unit tabs, two-state legend, block grid, `已用指令条数` and the blank state for units with no source.
