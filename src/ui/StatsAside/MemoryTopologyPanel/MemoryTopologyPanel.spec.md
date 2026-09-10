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

**No slot —** `l0c-l1` / `l0c-l2` (L0C→L1 / L0C→GM data volumes, KB) have no plate in the export, which carries no KB values; they stay in the Memory.csv 详情 tabs. The same is true of the AIV0/AIV1 SIMT in/out pair, the four in-row SIMT links per AIV row, the UB→VEC run, the two rotated AIV↔AIC trunk labels, AIC `L1→MTE1#3→BT`, `FixP→rail`, and the 9 in-box `%` plates other than L2 Peak — the adapter computes no such edge.

## Acceptance Criteria

1. **PR-MEMTOP-001** — Renders the chrome asset `memory-topology.svg` at 448×540 with the L2 node anchor.
2. **PR-MEMTOP-002** — Renders data-driven edge labels (GB/s) from `model.edges`; Vec↔UB on AIV0 and AIV1; AIC L1/L0/Cube labels when present.
3. **PR-MEMTOP-003** — Omits the label for an edge with no `label` (slot drawn, blank).
4. **PR-MEMTOP-004** — Hides the diagram when `model` is null/empty.
5. **PR-MEMTOP-005** — Edge labels update when `model.edges` labels change.
6. **PR-MEMTOP-006** — GM↔L2 labels sit between the GM and L2 pillars; L2↔cluster labels sit between the L2 pillar and the row stack. The export draws these horizontally in the corridor (the earlier redraw rotated them).
7. **PR-MEMTOP-007** — When `l2.peakPct` is set, shows `{n}%` in the L2 plate (no “Peak” word) and hides the `l2-hit` edge label.
7b. **PR-MEMTOP-007b** — Omits Peak chrome when `peakPct` is absent.
8. **PR-MEMTOP-008** — Right-click emits `open-details`.
8b. **PR-MEMTOP-008b** — Right-click does not emit when `openDetailsOnContextmenu` is false.
9. **PR-MEMTOP-009** — Edges with no chrome slot (`l0c-l1`, `l0c-l2`) are not drawn.

## Visual

Chrome: [`memory-topology.svg`](./memory-topology.svg) — official export, static labels kept as outlines, sample values removed in-repo. Crops: [`visual/buffer-links.png`](./visual/buffer-links.png), [`visual/memory-topology.png`](./visual/memory-topology.png) — [`visual/provenance.yaml`](./visual/provenance.yaml).

| Token | Value |
|-------|--------|
| Panel bg | `#262626` |
| Chrome art | `memory-topology.svg` (self-contained fills: GM `#4d4d4d`, L2 `#666666`, cache/UB units `#668cf7`, compute units `#36c18d`, muted `#666666`, MTE chips `#f69e39`) |
| Edge label | `#f9b665` `6.6px` bold — sized to the export's 27.6-unit plates (8px overflows them) |
| L2 Peak(%) | DATA-20: `{n}%` in the L2 plate; `#f0f0f0` |
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
