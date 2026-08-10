# StatsAside

| spec-id-prefix |
|----------------|
| PR-STATS-*   |

Right-side analytics panel: shell chrome (title, close, meta, 更多), mode switcher (Summary | PIPE | compute | memory), PIPE bars with Cube|Vector (MIX), and CSV detail tabs (#2–#4).

## Inputs

**report** — `ReportViewModel` including `computeTables`, `memoryTables`, `csvTexts`. Optional **locale**. Optional **capabilities** (e.g. `hardwareDetails`) gates shell controls that need feature flags.

## Outputs

- **close** — aside close control; parent clears `asideVisible`.
- **open-hardware-details** — **更多** / More (emit intent).
- **view-full-csv** — re-emitted from `CsvFieldListPanel` (I-Q6d).

## Behavior

### Shell (header chrome)

Localized **summary** title with decorative chart icon. Close emits **close**. Meta row shows **核数** / **aic频率** / **NPU ARCH** only when set; hides when none. **`ratedFreq` omitted** from shell. **更多** when meta visible or `hardwareDetails` capability.

### Mode switcher

Shows available modes only (hide empty). Default = first available.

**Summary.** Thin I-Q6a cards.

**PIPE.** Bars + Cube|Vector toggle for MIX; blank/unrecognized opType shows all sides.

**Compute / Memory.** Hosts `CsvFieldListPanel` with tabs, block switcher, search, 查看全部.

## Acceptance Criteria

1. **PR-STATS-001** — Renders summary stats.
2. **PR-STATS-002** — Renders PIPE bars with correct colors.
3. **PR-STATS-003** — Cube|Vector toggle appears only for MIX; filters bars by side.
4. **PR-STATS-004** — Blank or unrecognized `opType` shows all PIPE sides.
5. **PR-STATS-005** — Compute/memory modes show CSV tabs and emit `view-full-csv`.
6. **PR-STATS-006** — Header title and close emit.
7. **PR-STATS-007** — Meta hide-if-missing.
8. **PR-STATS-008** — More emits open-hardware-details.

## Edge Cases

| State | Behavior |
|---|---|
| report is null or undefined | Empty panel, no error; title + close still shown |
| Empty pipeOccupancy | No bars; summary still visible if present |
| Non-MIX known opType | No Cube|Vector toggle; side-filtered bars |
| Blank/unrecognized opType | Show all PIPE bars |
| No meta fields and no `hardwareDetails` | Meta row and 更多 hidden |
| Meta fields present, no capability | Meta + 更多 shown; emit only |

## Design sketches

- [report-stats.png](../../../docs/specs/ui/source/report-stats.png) — header / meta / 更多
- [general.png](../../../docs/specs/ui/general.png) — aside chrome in layout
- [changes.png](../../../docs/source/changes/changes.png) #2–#4
- [PIPE occupancy](../../../docs/specs/ui/source/pipe-occupancy.png)

## Dependencies

[COLOR_TOKENS.md](../../../docs/specs/ui/COLOR_TOKENS.md), [view-models](../../../specs/core/view-models.spec.md), [INTERACTIONS.md](../../../docs/specs/ui/INTERACTIONS.md), I-Q6a/b/c/d.

## Changelog
- **2026-08-07** — Shell close/meta/更多 (PR-STATS-006–008).
- **2026-08-07** — Mode switcher + compute/memory CSV panels (PR-STATS-005).
- **2026-08-07** — Unrecognized opType shows all PIPE sides; PR-STATS-004.
- **2026-08-07** — Cube|Vector toggle on existing PIPE panel only.
- **2026-08-05** — Initial spec.

## Open

Q22 — measureRange aside sync. Q7 — HardwareDetailsPanel.
