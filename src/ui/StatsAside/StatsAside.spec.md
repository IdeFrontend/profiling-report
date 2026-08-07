# StatsAside

| spec-id-prefix |
|----------------|
| PR-STATS-*   |

Right-side analytics panel: mode switcher (Summary | PIPE | compute | memory), PIPE bars with Cube|Vector (MIX), and CSV detail tabs (#2–#4).

## Inputs

**report** — `ReportViewModel` including `computeTables`, `memoryTables`, `csvTexts`. Optional **locale**.

## Outputs

- **view-full-csv** — re-emitted from `CsvFieldListPanel` (I-Q6d).

## Behavior

**Mode switcher.** Shows available modes only (hide empty). Default = first available.

**Summary.** Thin I-Q6a cards.

**PIPE.** Bars + Cube|Vector toggle for MIX; blank/unrecognized opType shows all sides.

**Compute / Memory.** Hosts `CsvFieldListPanel` with tabs, block switcher, search, 查看全部.

## Acceptance Criteria

1. **PR-STATS-001** — Renders summary stats.
2. **PR-STATS-002** — Renders PIPE bars with correct colors.
3. **PR-STATS-003** — Cube|Vector toggle appears only for MIX; filters bars by side.
4. **PR-STATS-004** — Blank or unrecognized `opType` shows all PIPE sides.
5. **PR-STATS-005** — Compute/memory modes show CSV tabs and emit `view-full-csv`.

## Design sketches

- [changes.png](../../../docs/source/changes/changes.png) #2–#4
- [PIPE occupancy](../../../docs/specs/ui/source/pipe-occupancy.png)

## Changelog
- **2026-08-07** — Mode switcher + compute/memory CSV panels (PR-STATS-005).
- **2026-08-07** — Unrecognized opType shows all PIPE sides; PR-STATS-004.
- **2026-08-07** — Cube|Vector toggle on existing PIPE panel only.
- **2026-08-05** — Initial spec.
