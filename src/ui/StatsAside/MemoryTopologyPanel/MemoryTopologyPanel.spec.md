# MemoryTopologyPanel

| spec-id-prefix |
|----------------|
| PR-MEMTOP-*    |

Static memory-path topology diagram with **data-driven Buffer-link labels** (change-log #5, Q12).

## Inputs

**model** — `MemoryTopologyModel` (`nodes` + `edges`; each edge carries an optional data-driven `label`). **selectedBlockId** — active `block_id` for label scoping (I-Q6c). Optional **locale**.

## Outputs

None — display-only. The parent `StatsAside` owns block switching.

## Behavior

1. Render the static topology chrome: GM/HBM → L2 → AIC (L1, L0A/B/C, Cube, FixP, Scalar) and AIV×2 (UB, Vec/SIMT/SIMD, Scalar), plus the redrawn nodes `XN_IMM` / `Data Cache` ([VIEW_DATA_MAPPING §11.2.6](../../../../docs/ui/VIEW_DATA_MAPPING.md)).
2. Overlay GB/s (or KB) labels on Buffer links from the §11.2.6 edge→field→source table. Omit a label when the mapped CSV value is missing/`NA`.
3. Labels are **block-scoped** via `selectedBlockId` (I-Q6c); re-derive labels when the block changes.
4. Edge thickness stays static (not data-driven).
5. Hide the diagram (empty root) when `model` is absent or has no labelled edges.

## Acceptance Criteria

1. **PR-MEMTOP-001** — Renders the topology nodes (GM, L2 Cache, Cube, UB, …).
2. **PR-MEMTOP-002** — Renders data-driven edge labels (GB/s) from `model.edges`.
3. **PR-MEMTOP-003** — Omits the label for an edge whose value is `NA`/missing.
4. **PR-MEMTOP-004** — Hides the diagram when `model` is null/empty.
5. **PR-MEMTOP-005** — Edge labels re-derive on `selectedBlockId` change.

## Visual

Crops: [`visual/buffer-links.png`](./visual/buffer-links.png), [`visual/memory-topology.png`](./visual/memory-topology.png) — [`visual/provenance.yaml`](./visual/provenance.yaml).

## Design sketches

- [buffer-links](./visual/buffer-links.png) — from `v930/change-log` (#5)
- [memory-topology](./visual/memory-topology.png) — from `v930/report-stats-scrolled`
- [change-log](../../../../docs/ui/source/v930/change-log.jpeg) — full frame
- [report-stats-scrolled](../../../../docs/ui/source/v930/report-stats-scrolled.jpeg) — full frame

## Dependencies

I-Q6c, Q12, [view-models](../../../../specs/core/view-models.spec.md), [VIEW_DATA_MAPPING §11.2.6](../../../../docs/ui/VIEW_DATA_MAPPING.md).

## Changelog

- **2026-08-12** — Initial spec from change-log #5 (Buffer-link redraw).
