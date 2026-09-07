# MemoryTopologyPanel

| spec-id-prefix |
|----------------|
| PR-MEMTOP-*    |

Static memory-path topology diagram with **data-driven Buffer-link labels** (change-log #5, UI-38).

## Inputs

**model** — `MemoryTopologyModel` (`nodes` + `edges`; each edge carries an optional data-driven `label`). Optional **locale**. Parent `StatsAside` owns block switching and rebuilds **model** via `buildMemoryTopology`.

## Outputs

**open-details** — UI-35: right-click on the diagram opens the parent memory CSV overlay (same as **详情**).

## Behavior

1. Render the static topology chrome: GM/HBM → L2 → AIC (L1, L0A/B/C, Cube, FixP, Scalar) and AIV×2 (UB, Vec/SIMT/SIMD, Scalar), plus the redrawn nodes `XN_IMM` / `Data Cache` ([VIEW_DATA_MAPPING §11.2.6](../../../../docs/ui/VIEW_DATA_MAPPING.md)).
2. Overlay GB/s (or KB) labels on Buffer links from `model.edges`. Omit a label when the edge has no `label` (the adapter hides `NA` and formats `0`). GM↔L2 and L2↔cluster labels sit in the corridors **between** pillars (rotated −90°), not on the GM/L2 rects. VEC↔UB labels sit in the gap under the UB box on **both** AIV0 and AIV1, not on the cache fill. AIC L1/L0/Cube labels sit in the gap under the AIC boxes.
3. Labels follow the **model** the parent passes; when the parent rebuilds for a new `block_id`, labels update.
4. Edge thickness stays static (not data-driven).
5. Hide the diagram (empty root) when `model` is absent or has no labelled edges.
6. **L2 Peak(%) (DATA-20):** when the `l2` node has `peakPct`, show `{n}%` under **L2 Cache** on the pillar (sketch: no “Peak” word, no warm tint; flat L2 fill). Hide the separate `l2-hit` edge label when Peak is shown (same value). Other units have no Peak until Product maps them.
7. **Right-click (UI-35):** `contextmenu` on the diagram emits `open-details` (prevent default). Parent opens the memory CSV overlay (Memory / L2Cache / MemoryUB / MemoryL0).

## Acceptance Criteria

1. **PR-MEMTOP-001** — Renders the topology nodes (GM, L2 Cache, Cube, UB, …).
2. **PR-MEMTOP-002** — Renders data-driven edge labels (GB/s) from `model.edges`; Vec↔UB on AIV0 and AIV1; AIC L1/L0/Cube labels when present.
3. **PR-MEMTOP-003** — Omits the label for an edge with no `label`.
4. **PR-MEMTOP-004** — Hides the diagram when `model` is null/empty.
5. **PR-MEMTOP-005** — Edge labels update when `model.edges` labels change.
6. **PR-MEMTOP-006** — GM↔L2 labels sit between GM and L2; L2↔cluster labels sit between L2 and the AIV/AIC cluster (rotated).
7. **PR-MEMTOP-007** — When `l2.peakPct` is set, shows `{n}%` under L2 Cache (no “Peak” word) and uses flat L2 fill.
7b. **PR-MEMTOP-007b** — Omits Peak chrome when `peakPct` is absent.
8. **PR-MEMTOP-008** — Right-click emits `open-details`.

## Visual

Crops: [`visual/buffer-links.png`](./visual/buffer-links.png), [`visual/memory-topology.png`](./visual/memory-topology.png) — [`visual/provenance.yaml`](./visual/provenance.yaml). Normative colors from `v930/report-stats-scrolled` / change-log buffer-links.

| Token | Value (sampled from `memory-topology.png`) |
|-------|--------|
| Panel bg | `#262626` |
| GM / muted | `#4d4d4d` |
| L2 / FixP | `#657294` (+ FixP stroke `#848ea9`) |
| Cache / UB / L1 / L0 / SIMT | `#668cf7` (+ stroke `#85a3f9`) |
| Compute (CUBE / Vec / Scalar) | `#37c18d` (+ stroke `#5ecda3`) |
| Cluster dash | `#e8e8e8` `1px` dashed `5 5` |
| Edge label | `#f9b665` `8px`; GM↔L2 / L2↔cluster rotated −90° in corridors |
| Corridor arrows | `#3978f9` (read and write) |
| L2 Peak(%) | DATA-20: `{n}%` under L2 Cache; white |

## Design sketches

- [buffer-links](./visual/buffer-links.png) — from `v930/change-log` (#5)
- [memory-topology](./visual/memory-topology.png) — from `v930/report-stats-scrolled`
- [change-log](../../../../docs/ui/source/v930/change-log.jpeg) — full frame
- [report-stats-scrolled](../../../../docs/ui/source/v930/report-stats-scrolled.jpeg) — full frame

## Dependencies

DATA-20 (L2 Peak), DATA-21, DATA-33c, UI-35, UI-38, [view-models](../../../../specs/core/view-models.spec.md), [VIEW_DATA_MAPPING §11.2.6](../../../../docs/ui/VIEW_DATA_MAPPING.md).

## Changelog
- **2026-09-07** — Match `report-stats-scrolled` colors (cache/compute/L2/arrows/dash); L2 Peak as `{n}%` without tint; CUBE/LOC/FixP roles.
- **2026-09-07** — L2 Peak(%) from `peakPct` (DATA-20) + right-click `open-details` (UI-35).
- **2026-08-21** — GM↔L2 arrows: read = leaving GM (GM→L2 gold), write = arriving at GM (L2→GM blue).
- **2026-08-20** — Product NA rule (hide NA, show 0) lives in the adapter; panel still omits edges with no `label`. UB prefers MemoryUB names then Memory.csv.

- **2026-08-14** — AIC-internal L1/L0/Cube labels (PR-MEMTOP-002).
- **2026-08-13** — Corridor labels (PR-MEMTOP-006); rotated GB/s between pillars.
- **2026-08-13** — Presentational model; parent rebuilds labels (PR-MEMTOP-005).
- **2026-08-12** — Initial spec from change-log #5 (Buffer-link redraw).
