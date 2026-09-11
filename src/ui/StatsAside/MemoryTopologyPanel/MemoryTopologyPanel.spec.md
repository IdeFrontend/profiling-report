# MemoryTopologyPanel

| spec-id-prefix |
|----------------|
| PR-MEMTOP-*    |

Official product memory-path topology chrome with **data-driven link values** (change-log #5, UI-38).

## Inputs

**model** — `MemoryTopologyModel` (`nodes` + `edges`; each edge carries an optional data-driven `label`; the `l2` node may carry `peakPct`). Optional **locale**. Optional **openDetailsOnContextmenu** (default true): stacked diagram keeps UI-35; the root fullscreen overlay passes `false`. Parent `StatsAside` owns block switching and rebuilds **model** via `buildMemoryTopology`.

## Outputs

**open-details** — UI-35: right-click on the stacked diagram opens the parent memory CSV overlay (same as **详情**). Not emitted when `openDetailsOnContextmenu` is false (fullscreen overlay).

## Behavior

1. Render the official chrome asset `memory-topology.svg` (Figma export of `v930/report-stats-scrolled` 内存负载分析, 448×540 units) at full size. Everything static lives in the asset and is **not** drawn by this component: GM/HBM → L2 → AIC (L1, L0A/B/C, Cube, FixP, Scalar) and AIV0/AIV1 (UB, SIMT/SIMD, Vec, Scalar, DCache, MTE1/2/3, FixPipe, BT/FB/SS), the `XN_IMM` / `Data Cache` nodes, boxes, arrows, dashes and the value plates ([VIEW_DATA_MAPPING §11.2.6](../../../../docs/ui/VIEW_DATA_MAPPING.md)). Because the chrome owns the arrows, the panel renders no SVG `<marker>`s.
2. Overlay the values from `model.edges` as SVG `<text>` at the **value slots** below — the centres of the placeholder values that were stripped from the export.
3. One `<text>` per slot is always drawn, including when the edge has no `label` (empty content). The adapter hides `NA` and formats `0`, so an omitted value leaves a visibly blank plate rather than a missing node.
4. Slot geometry is fixed; only the text is data-driven. A pair's upper slot rides the link whose arrowhead points into the right-hand box (GM→L2, L2→UB, UB→SIMD, Cube→L0C).
5. Values follow the **model** the parent passes; when the parent rebuilds for a new `block_id`, values update.
6. Hide the diagram (empty root) when `model` is absent or has no labelled edges.
7. **L2 Peak(%) (DATA-20):** when the `l2` node has `peakPct`, show `{n}%` in the export's in-box plate under **L2 Cache** (no “Peak” word, no warm tint). Otherwise fall back to the `l2-hit` edge label in the same plate; never both. Other units have no Peak until Product maps them.
8. **Right-click (UI-35):** `contextmenu` on the diagram prevent-defaults. When `openDetailsOnContextmenu` is true (stacked aside), emit `open-details` so the parent opens the memory CSV overlay (Memory / L2Cache / MemoryUB / MemoryL0). When false (root fullscreen overlay), do not emit; overlay stays open.
9. Fullscreen chrome (Back, **全屏** control) lives on `ProfilingReport` / `StatsAside`; this panel stays presentational.
10. **Value fit (PR-MEMTOP-010):** a value wider than its own slot's corridor is drawn at a proportionally smaller `font-size` so it stays inside the link, instead of overlapping a pillar or a neighbouring unit. Values that fit keep the base size; nothing else about the slot moves.
11. **Accessible description (PR-MEMTOP-011):** the root `role="img"` makes the diagram one image, so its `<text>` values do not reach the a11y tree by themselves. The panel therefore also renders a visually hidden list of the slots it draws — `{from} → {to}: {value}` per slot plus the L2 plate, from the model's own node labels and edge labels — and points the `svg` at it with `aria-describedby`. Slots left blank and edges with no slot are omitted, so the description lists exactly what is drawn. Each instance uses its own id (`useId`), because the stacked aside and the fullscreen overlay render two panels at once.
12. **Slot testids (PR-MEMTOP-002b):** `data-testid` is `edge-{edge-id}-{slotIndex}`, so the AIV0/AIV1 pairs resolve to distinct elements.

### Value slots (edge → label centres, chrome units)

Pillars: GM x16–56, L2 x94–134; row stack x188–432 — AIV0 y17–197, AIC y201–339, AIV1 y343–523.

| Edge | Slots | Link |
|------|-------|------|
| `gm-l2-read` | (74.5, 255.9) | GM → L2 |
| `gm-l2-write` | (75.3, 277.8) | L2 → GM |
| `l2-ub` | (159.7, 106.4), (159.7, 426.6) | L2 → UB, AIV0 + AIV1 |
| `ub-l2` | (160.4, 121.3), (159.7, 441.5) | UB → L2, AIV0 + AIV1 |
| `l2-l1-read` | (159.7, 235.5) | L2 → MTE2 → L1 (AIC) |
| `l2-l1-write` | (159.7, 273.1) | L2 ↔ AIC corridor (see note) |
| `ub-vec` | (338.2, 153.4), (338.2, 473.3) | UB → SIMD, AIV0 + AIV1 |
| `vec-ub` | (338.2, 165.2), (338.2, 485.4) | SIMD → UB, AIV0 + AIV1 |
| `l1-l0a` | (239.7, 221.7) | L1 → MTE1 → L0A |
| `l1-l0b` | (240.1, 234.3) | L1 → MTE1 → L0B |
| `l0a-cube` | (302.9, 222.5) | L0A → Cube |
| `l0b-cube` | (302.9, 235.5) | L0B → Cube |
| `cube-l0c` | (373.5, 229.2) | Cube → L0C |
| `l0c-cube` | (373.5, 244.5) | L0C → Cube |
| L2 plate | (113.8, 277.1) | in-box plate on the L2 pillar — `peakPct`, else `l2-hit` |

**Slot note —** the export routes its lower L2↔AIC corridor link on to FixP; the panel labels that corridor slot with the Memory.csv L1 write-back (`aic_l1_write_bw`), which is the same L2↔AIC path.

### Value fit (PR-MEMTOP-010)

The export's slots were sized for its own 27.6-unit placeholders. Real values are longer (`{n}.{nn} GB/s`, KB volumes) and the system sans is wider per cap height than the export's face (~1.2×), so a label can outgrow its link. Each slot has a **corridor** — the free run between the chrome around it, measured off the export at the value's own height band. A value is drawn centred on its slot, not on the corridor, so the binding constraint is the **nearer** wall:

| Slot | Corridor (walls, chrome units) | Bound |
|------|-------------------------------|-------|
| `gm-l2-read` / `gm-l2-write` | x≈55.75 … x≈94 | 35.4 |
| `l2-ub`, `ub-l2`, `l2-l1-read`, `l2-l1-write` | x≈133.75 … x≈188 | 49.9 |
| `ub-vec` / `vec-ub` | x≈315 … x≈361 | 42.1 |
| `l1-l0a` / `l1-l0b` | x≈217 … x≈262 | 41.1 / 40.3 |
| `l0a-cube` / `l0b-cube` | x≈282 … x≈322 | 36.7 / 34.7 |
| `cube-l0c` / `l0c-cube` | x≈353 … x≈394 | 37.5 |
| L2 plate (`peakPct` / `l2-hit`) | x≈94 … x≈133.75 (the pillar) | 36 |

**Every** slot carries its own bound (`SLOT_MAX_W`): the row stack's inner corridors are far tighter than the pillars' (L0B↔Cube is 34.7 against L2↔row's 49.9), so no single bound serves them all. A slot the table forgets falls back to the **tightest** bound (34.7) — a generous fallback would silently overflow a narrow corridor. A value whose natural width exceeds its bound is drawn at `bound / natural × 6.3px` — the same strokes, scaled down — so e.g. `504.00 GB/s` (43.2 units) lands at 5.17px inside the GM↔L2 link and at 5.06px inside L0B↔Cube. Widths come from the rendered label's own metrics (`getComputedTextLength`), so they follow the platform font; where metrics are unavailable — a non-browser DOM, or a mount inside a hidden container, where text has no layout and measures 0 — the panel keeps the base size.

**No slot —** `l0c-l1` / `l0c-l2` (L0C→L1 / L0C→GM data volumes, KB) have no plate in the export, which carries no KB values; they stay in the Memory.csv 详情 tabs. The same is true of the AIV0/AIV1 SIMT in/out pair, the four in-row SIMT links per AIV row, the UB→VEC run, the two rotated AIV↔AIC trunk labels, AIC `L1→MTE1#3→BT`, `FixP→rail`, and the 9 in-box `%` plates other than L2 Peak — the adapter computes no such edge.

**MTE blocks (UI-38) —** the chrome draws `MTE1`/`MTE2`/`MTE3` boxes (AIV0/AIV1 columns, the AIC column and the L2↔cluster trunk), but the export gives every one of them **no value plate**: all 10 in-box `%` plates belong to other units (L2, UB/Scalar, CUBE/FixP, SIMT/SIMD/VEC). The panel therefore draws no slot for MTE and the diagram stays exactly as designed. The blocks are modelled as nodes (`mte1`/`mte2`/`mte3`) and their utilizations are read from `PipeUtilization.csv` in the memory 详情 CSV field list ([StatsAside](../StatsAside.spec.md) PR-STATS-035).

## Acceptance Criteria

1. **PR-MEMTOP-001** — Renders the chrome asset `memory-topology.svg` at 448×540 with the L2 node anchor.
2. **PR-MEMTOP-002** — Renders data-driven edge labels (GB/s) from `model.edges`; Vec↔UB on AIV0 and AIV1; AIC L1/L0/Cube labels when present.
2b. **PR-MEMTOP-002b** — Every drawn value carries a unique `data-testid` (`edge-{edge-id}-{slot}`), so a `getByTestId`-style query resolves to one element even for the AIV0/AIV1 pairs.
3. **PR-MEMTOP-003** — Omits the label for an edge with no `label` (slot drawn, blank).
4. **PR-MEMTOP-004** — Hides the diagram when `model` is null/empty.
5. **PR-MEMTOP-005** — Edge labels update when `model.edges` labels change.
6. **PR-MEMTOP-006** — GM↔L2 labels sit between the GM and L2 pillars; L2↔cluster labels sit between the L2 pillar and the row stack. The export draws these horizontally in the corridor (the earlier redraw rotated them).
7. **PR-MEMTOP-007** — When `l2.peakPct` is set, shows `{n}%` in the L2 plate (no “Peak” word) and hides the `l2-hit` edge label.
7b. **PR-MEMTOP-007b** — Omits Peak chrome when `peakPct` is absent.
7c. **PR-MEMTOP-007c** — With `peakPct` absent, the same single plate shows the `l2-hit` edge label; the two sources never both render.
8. **PR-MEMTOP-008** — Right-click emits `open-details`.
8b. **PR-MEMTOP-008b** — Right-click does not emit when `openDetailsOnContextmenu` is false.
9. **PR-MEMTOP-009** — Edges with no chrome slot (`l0c-l1`, `l0c-l2`) are not drawn.
10. **PR-MEMTOP-010** — A value wider than its slot's corridor is scaled down proportionally so it stays inside the link; values that fit keep the base size, and the slot geometry never moves.
11. **PR-MEMTOP-011** — The diagram's `role="img"` hides its `<text>` values from the a11y tree, so the same slots are exposed as an accessible description (`aria-describedby` → a visually hidden `from → to: value` list, built from the model). One description per instance: the panel renders twice at once, so the id must not collide.

## Visual

Chrome: [`memory-topology.svg`](./memory-topology.svg) — official export, static labels kept as outlines, sample values removed in-repo, and the export's full-canvas 5% white **artboard lift removed too**: over this `#262626` card it rendered `#313131`, a visibly lighter rectangle than the card it sits in (the sketch has no `#313131` surface). The diagram now shares the card's `#262626`, and only its three inner row panels keep their export 3% lift (`#2d2d2d`), which is what the sketch shows. The asset is **not bundled into the JS**: it is imported with `?no-inline` (lib mode inlines every JS-referenced asset regardless of `assetsInlineLimit`; `?no-inline` is the one suffix Vite checks first) and shipped as `dist/memory-topology.svg`, referenced at the root path `/memory-topology.svg`. A host embedding the library must serve that file next to the bundle, otherwise the chrome renders empty and only the overlaid values remain. Crops: [`visual/buffer-links.png`](./visual/buffer-links.png), [`visual/memory-topology.png`](./visual/memory-topology.png) — [`visual/provenance.yaml`](./visual/provenance.yaml).

| Token | Value |
|-------|--------|
| Panel bg | `#262626` (shared with the diagram base — the chrome paints no artboard) |
| Row panel | `#2d2d2d` (the chrome's 3% white lift over the panel) |
| Chrome art | `memory-topology.svg` (self-contained fills: GM `#4d4d4d`, L2 `#666666`, cache/UB units `#668cf7`, compute units `#36c18d`, muted `#666666`, MTE chips `#f69e39`) |
| Edge label | `#f9b766` `800` `6.3px` base — the export's values measure 27.6 × 4.25 units (cap height), so the size is set from the cap height; the system sans is ~1.2× wider per cap height and real values are longer than its placeholders, so a value that outgrows its corridor is scaled down per slot (PR-MEMTOP-010) |
| L2 Peak(%) | DATA-20: `{n}%` in the L2 plate; `#fff`, same size and fit as the edge labels |
| L2 node anchor | transparent (the chrome supplies the fill) |

## Design sketches

- [`memory-topology.svg`](./memory-topology.svg) — official product export, `v930/report-stats-scrolled` 内存负载分析
- [buffer-links](./visual/buffer-links.png) — from `v930/change-log` (#5)
- [memory-topology](./visual/memory-topology.png) — from `v930/report-stats-scrolled`
- [change-log](../../../../docs/ui/source/v930/change-log.jpeg) — full frame
- [report-stats-scrolled](../../../../docs/ui/source/v930/report-stats-scrolled.jpeg) — full frame

## Dependencies

DATA-20 (L2 Peak), DATA-21, DATA-33c, UI-35, UI-38, [view-models](../../../../specs/core/view-models.spec.md), [VIEW_DATA_MAPPING §11.2.6](../../../../docs/ui/VIEW_DATA_MAPPING.md).

## Changelog
- **2026-09-11** — Review follow-ups on this panel: (a) the L2 plate was two `v-if`/`v-else-if` `<text>` elements whose branches could never both render while the styling was identical — collapsed to one element with a conditional `data-testid` (PR-MEMTOP-007c); (b) `data-testid` was `edge-{edge-id}`, duplicated by the AIV0/AIV1 pairs, now `edge-{edge-id}-{slot}` (PR-MEMTOP-002b); (c) `role="img"` left the drawn values out of the a11y tree, now also exposed as a visually hidden description wired through `aria-describedby`, id per instance via `useId` (PR-MEMTOP-011); (d) `locale` gained an explicit `undefined` default for `vue/require-default-prop`.
- **2026-09-11** — Value fit bounds made per-slot: `SLOT_MAX_W` previously covered only GM↔L2 and the L2 plate and let every other slot fall back to a 49.9-unit default measured from the L2↔row corridor. The row stack's inner corridors are much tighter — L0B↔Cube 34.7, L0A↔Cube 36.7, Cube↔L0C 37.5, L1↔L0A/B 41.1/40.3, UB↔SIMD 42.1 — so a 3-digit label (`{n}.{nn} GB/s` ≈ 41.7 units; the sample fixture already shows `504.00 GB/s` on GM↔L2) would have overlapped the L0/Cube boxes that PR-MEMTOP-010 exists to protect. All 14 slots now carry a measured bound and the fallback is the tightest one; the corridor test covers every slot instead of four.
- **2026-09-10** — Chrome artboard lift removed: the export paints a full-canvas `rgba(255,255,255,0.05)` frame, which over the `#262626` card rendered the diagram as `#313131` — a lighter rectangle than the card around it. The sketch has no `#313131` surface (only `#262626` cards and `#2d2d2d` inner panels), so the frame is stripped; the diagram base is now the card's `#262626` and the three 3% row panels land on `#2d2d2d`, matching the sketch.
- **2026-09-10** — Chrome asset kept out of the JS bundle: imported with `?no-inline` and shipped as `dist/memory-topology.svg` for the host to serve (lib build 712 kB → 479 kB). Vite's lib mode inlines every JS-referenced asset regardless of `assetsInlineLimit`, so the suffix is the only lever; noted in `vite.config.ts` and in Visual.
- **2026-09-10** — Value fit (PR-MEMTOP-010): a value wider than its slot's corridor is scaled down proportionally instead of overlapping the pillars. Bounds are the *nearer* wall (35.4 units GM↔L2, 49.9 elsewhere, 36 in the L2 plate) since a value is centred on its slot, and widths come from the rendered label's own metrics. The previous "system sans is ~8% wider" note was also too low — measured ~1.2× per cap height, plus one more digit than the export's placeholders.
- **2026-09-10** — Value type re-measured against the export: label colour `#f9b665` → `#f9b766` (the export's exact amber), L2 `%` colour `#f0f0f0` → `#fff`, size `6.6px` → `6.3px` (the export's cap height is 4.4 units; 6.6px was ~6% taller) and weight `700` → `800` (the export's strokes are heavier than the system bold).
- **2026-09-10** — MTE blocks modelled (UI-38): the chrome's `MTE1/2/3` boxes have no value plate in the export, so no slot is drawn; the nodes exist in the model and their utilizations come from `PipeUtilization.csv` in the memory 详情 list (PR-STATS-035).
- **2026-09-10** — Chrome replaced by the official product SVG export; values overlaid at its slots. No in-DOM `<marker>`s (the asset owns the arrows). Corridor labels are horizontal as in the export. `l0c-l1` / `l0c-l2` lose their diagram slot (no KB plate in the export) — PR-MEMTOP-001/002/006 reworded, PR-MEMTOP-009 added.
- **2026-09-08** — Same panel in the root fullscreen overlay; overlay passes `openDetailsOnContextmenu: false` so right-click does not emit (PR-MEMTOP-008b).
- **2026-09-07** — Match `report-stats-scrolled` colors (cache/compute/L2/arrows/dash); L2 Peak as `{n}%` without tint; CUBE/LOC/FixP roles.
- **2026-09-07** — L2 Peak(%) from `peakPct` (DATA-20) + right-click `open-details` (UI-35).
- **2026-08-21** — GM↔L2 arrows: read = leaving GM (GM→L2 gold), write = arriving at GM (L2→GM blue).
- **2026-08-20** — Product NA rule (hide NA, show 0) lives in the adapter; panel still omits edges with no `label`. UB prefers MemoryUB names then Memory.csv.
- **2026-08-14** — AIC-internal L1/L0/Cube labels (PR-MEMTOP-002).
- **2026-08-13** — Corridor labels (PR-MEMTOP-006); rotated GB/s between pillars.
- **2026-08-13** — Presentational model; parent rebuilds labels (PR-MEMTOP-005).
- **2026-08-12** — Initial spec from change-log #5 (Buffer-link redraw).
