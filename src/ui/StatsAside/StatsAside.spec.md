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
- **open-pipe-details** — **详情** / Details on the PIPE section (emit intent; detail panel is a separate slice).

## Behavior

### Shell (header chrome)

Localized **summary** title with decorative chart icon. Close emits **close**. Meta row shows **核数** / **aic频率** / **NPU ARCH** only when set; hides when none. **`ratedFreq` omitted** from shell. **更多** when meta visible or `hardwareDetails` capability.

### Mode switcher

Shows available modes only (hide empty). Default = first available.

### Summary cards

I-Q6a thin tiles only. Card group renders when `taskDurationUs` is present (name/type alone do not open an empty grid).

**Duration card (整体耗时).** Localized label; large primary value from formatted `taskDurationUs`; thin decorative progress track with a fixed short cyan fill (`--pr-color-duration-bar`) — visual chrome only, **not** a utilization scale (I-Q6e). Secondary line (I-Q6e): if `blockDim` is set, show iterations/core style text; else fall back to `opName`; omit secondary if neither.

Do **not** render a standalone op-type card. Do **not** render compute / input BW / output BW / avg core util cards until Product Q6.

**PIPE.** Matches [`pipe-occupancy.png`](../../../docs/specs/ui/source/pipe-occupancy.png). Values are per-family means of non-NA ratios (I-Q6b). Bar colors match COLOR_TOKENS.

Section header shows localized **pipeOccupancy** title and a **详情** / Details control that emits **open-pipe-details** (no detail panel in this slice). A 0%–100% scale sits above the rows. Each row: label, track with solid fill for ratio and hatched remainder to 100%, optional in-bar absolute from `absoluteValue` (I-Q6f mean `*_time(us)`), and a right-aligned percent.

**Cube | Vector toggle.** When `summary.opType` is MIX (case-insensitive), show a Cube|Vector segmented control and filter `pipeOccupancy` by `side` (`cube` / `vector`). Each bar uses only that side’s CSV columns (`aic_*` vs `aiv_*`). Non-MIX with a known side (cube/aic or vector/aiv/vec): no toggle; show pipes for that side only. When `opType` is blank or unrecognized: no toggle; show all PIPE bars (do not default-filter to vector).

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
9. **PR-STATS-009** — Duration card sketch chrome.
10. **PR-STATS-010** — No type card; secondary hide-if-missing.
11. **PR-STATS-011** — Compute/BW/util cards absent.
12. **PR-STATS-012** — PIPE scale and hatched bars.
13. **PR-STATS-013** — Absolute time in bar when present.
14. **PR-STATS-014** — Details emit open-pipe-details.

## Edge Cases

| State | Behavior |
|---|---|
| report is null or undefined | Empty panel, no error; title + close still shown |
| Empty pipeOccupancy | No bars; summary still visible if present |
| Non-MIX known opType | No Cube|Vector toggle; side-filtered bars |
| Blank/unrecognized opType | Show all PIPE bars |
| Missing compute/BW fields (I-Q6a) | Fields absent; no sketch cards for those metrics |
| Duration without blockDim or opName | Duration card; no secondary line |
| No meta fields and no `hardwareDetails` | Meta row and 更多 hidden |
| Meta fields present, no capability | Meta + 更多 shown; emit only |
| Absolute time all NA | Bar shows ratio/% only; no in-bar absolute |

## Design sketches

- [report-stats.png](../../../docs/specs/ui/source/report-stats.png) — header / meta / 更多
- [general.png](../../../docs/specs/ui/general.png) — aside chrome in layout
- [changes.png](../../../docs/source/changes/changes.png) #2–#4
- [PIPE occupancy](../../../docs/specs/ui/source/pipe-occupancy.png)

## Dependencies

[COLOR_TOKENS.md](../../../docs/specs/ui/COLOR_TOKENS.md), [view-models](../../../specs/core/view-models.spec.md), [INTERACTIONS.md](../../../docs/specs/ui/INTERACTIONS.md), I-Q6a/b/c/d/e/f.

## Changelog
- **2026-08-07** — PIPE sketch chrome: scale, hatch, absolute time, Details (PR-STATS-012–014, I-Q6f).
- **2026-08-07** — Duration card chrome I-Q6e (PR-STATS-009–011).
- **2026-08-07** — Shell close/meta/更多 (PR-STATS-006–008).
- **2026-08-07** — Mode switcher + compute/memory CSV panels (PR-STATS-005).
- **2026-08-07** — Unrecognized opType shows all PIPE sides; PR-STATS-004.
- **2026-08-07** — Cube|Vector toggle on existing PIPE panel only.
- **2026-08-05** — Initial spec.

## Open

Q22 — measureRange aside sync. Q7 — HardwareDetailsPanel.
