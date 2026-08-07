# StatsAside

| spec-id-prefix |
|----------------|
| PR-STATS-*   |

Right-side analytics panel showing report summary statistics and PIPE occupancy bars (existing views only this branch).

## Inputs

**report** carries the full `ReportViewModel` with `summary` and `pipeOccupancy`. Optional **locale**.

## Outputs

Purely presentational — no emitted events.

## Behavior

**Summary section.** Displays operator metadata from `report.summary` (I-Q6a thin fields).

**PIPE occupancy bars.** Renders utilization bars. Values are per-family means of non-NA ratios (I-Q6b). Bar colors match COLOR_TOKENS.

**Cube | Vector toggle (M1 update to existing PIPE panel).** When `summary.opType` is MIX (case-insensitive), show a Cube|Vector segmented control and filter `pipeOccupancy` by `side` (`cube` / `vector`). Each bar uses only that side’s CSV columns (`aic_*` vs `aiv_*`). Non-MIX with a known side (cube/aic or vector/aiv/vec): no toggle; show pipes for that side only. When `opType` is blank or unrecognized: no toggle; show all PIPE bars (do not default-filter to vector).

**Planned (not in this branch’s code):** aside mode switcher, compute/memory CSV tabs, block switcher, 查看全部, topology — design specs only.

## Acceptance Criteria

1. **PR-STATS-001** — Renders summary stats.
2. **PR-STATS-002** — Renders PIPE bars with correct colors.
3. **PR-STATS-003** — Cube|Vector toggle appears only for MIX; filters bars by side.
4. **PR-STATS-004** — Blank or unrecognized `opType` shows all PIPE sides (no vector-only filter).

## Edge Cases

| State | Behavior |
|---|---|
| report is null or undefined | Empty panel, no error |
| Empty pipeOccupancy | No bars; summary still visible if present |
| Non-MIX known opType | No Cube|Vector toggle; side-filtered bars |
| Blank/unrecognized opType | Show all PIPE bars |
| Missing compute/BW fields (I-Q6a) | Fields absent |

## Design sketches

- [changes.png](../../../docs/source/changes/changes.png) #2
- [PIPE occupancy](../../../docs/specs/ui/source/pipe-occupancy.png)

## Dependencies

[COLOR_TOKENS.md](../../../docs/specs/ui/COLOR_TOKENS.md), [view-models](../../../specs/core/view-models.spec.md), I-Q6a/b.

## Open

Q22 — measureRange aside sync. Further M1/M2 aside surfaces.

## Changelog
- **2026-08-07** — Unrecognized opType shows all PIPE sides; PR-STATS-004.
- **2026-08-07** — Cube|Vector toggle on existing PIPE panel only.
- **2026-08-05** — Initial spec.
