# MemoryTopologyPanel

| spec-id-prefix |
|----------------|
| PR-MEMTOP-*    |

Static memory-path topology diagram with **data-driven Buffer-link labels** (change-log #5, Q12).

## Inputs

**model** — `MemoryTopologyModel` (`nodes` + `edges`; each edge carries an optional data-driven `label`). Optional **locale**. Parent `StatsAside` owns block switching and rebuilds **model** via `buildMemoryTopology`.

## Outputs

None — display-only.

## Behavior

1. Render the static topology chrome: GM/HBM → L2 → AIC (L1, L0A/B/C, Cube, FixP, Scalar) and AIV×2 (UB, Vec/SIMT/SIMD, Scalar), plus the redrawn nodes `XN_IMM` / `Data Cache` ([VIEW_DATA_MAPPING §11.2.6](../../../../docs/ui/VIEW_DATA_MAPPING.md)).
2. Overlay GB/s (or KB) labels on Buffer links from `model.edges`. Hide `NA`; **show 0**. GM↔L2 and L2↔cluster labels sit in the corridors **between** pillars (rotated −90°), not on the GM/L2 rects. VEC↔UB labels sit in the gap under the UB box on **both** AIV0 and AIV1, not on the cache fill. AIC L1/L0/Cube labels sit in the gap under the AIC boxes.
3. Labels follow the **model** the parent passes; when the parent rebuilds for a new `block_id`, labels update.
4. Edge thickness stays static (not data-driven).
5. Hide the diagram (empty root) when `model` is absent or has no labelled edges.

## Acceptance Criteria

1. **PR-MEMTOP-001** — Renders the topology nodes (GM, L2 Cache, Cube, UB, …).
2. **PR-MEMTOP-002** — Renders data-driven edge labels (GB/s) from `model.edges`; Vec↔UB on AIV0 and AIV1; AIC L1/L0/Cube labels when present.
3. **PR-MEMTOP-003** — Omits the label for an edge whose value is `NA`/missing; shows `0`.
4. **PR-MEMTOP-004** — Hides the diagram when `model` is null/empty.
5. **PR-MEMTOP-005** — Edge labels update when `model.edges` labels change.
6. **PR-MEMTOP-006** — GM↔L2 labels sit between GM and L2; L2↔cluster labels sit between L2 and the AIV/AIC cluster (rotated).

## Visual

Crops: [`visual/buffer-links.png`](./visual/buffer-links.png), [`visual/memory-topology.png`](./visual/memory-topology.png) — [`visual/provenance.yaml`](./visual/provenance.yaml).

| Token | Value |
|-------|--------|
| Panel bg | `#1a1a1a` |
| GM pillar | `#3a3a3a` |
| L2 pillar | `#4a6a8a` |
| Cache / UB / SIMT | `#3d6a9a` |
| Compute (Cube / Vec / Scalar) | `#2e7a3a` |
| DCache / XN_IMM | `#4a4a4a` |
| Cluster dash | `#6a6a6a` `1px` dashed |
| Edge label | `#e8c040` `8px`; GM↔L2 / L2↔cluster rotated −90° in corridors |
| Write arrows (GM→L2) | `#4a8ec8` |
| Read arrows (L2→GM) | `#e8c040` |
| Unit Peak(%) | omit until §11.2.6 mapping exists |

## Design sketches

- [buffer-links](./visual/buffer-links.png) — from `v930/change-log` (#5)
- [memory-topology](./visual/memory-topology.png) — from `v930/report-stats-scrolled`
- [change-log](../../../../docs/ui/source/v930/change-log.jpeg) — full frame
- [report-stats-scrolled](../../../../docs/ui/source/v930/report-stats-scrolled.jpeg) — full frame

## Dependencies

I-Q6c, Q12, [view-models](../../../../specs/core/view-models.spec.md), [VIEW_DATA_MAPPING §11.2.6](../../../../docs/ui/VIEW_DATA_MAPPING.md).

## Changelog
- **2026-08-20** — Product NA rule: hide NA, show 0. UB prefers MemoryUB names then Memory.csv.

- **2026-08-14** — AIC-internal L1/L0/Cube labels (PR-MEMTOP-002).
- **2026-08-13** — Corridor labels (PR-MEMTOP-006); rotated GB/s between pillars.
- **2026-08-13** — Presentational model; parent rebuilds labels (PR-MEMTOP-005).
- **2026-08-12** — Initial spec from change-log #5 (Buffer-link redraw).
