# StatsAside

| spec-id-prefix |
|----------------|
| PR-STATS-*   |

Right-side analytics panel: shell chrome (title, close, meta, 更多), mode switcher (Summary | PIPE | compute | memory), PIPE bars with Cube|Vector (MIX), CSV detail tabs (#2–#4), and optional Roofline (M2 interim).

## Inputs

**report** — `ReportViewModel` including `computeTables`, `memoryTables`, `csvTexts`, optional `roofline`, and optional `hardwareDetails`. Optional **locale**. Optional **capabilities** (e.g. `hardwareDetails`) gates shell controls that need feature flags.

## Outputs

- **close** — aside close control; parent clears `asideVisible`.
- **open-hardware-details** — **更多** / More (emit intent).
- **view-full-csv** — re-emitted from `CsvFieldListPanel` (I-Q6d).
- **open-pipe-details** — **详情** / Details on the PIPE section; switches to compute mode when compute tables exist, and always emits.

## Behavior

### Shell (header chrome)

Localized **summary** title with decorative chart icon. Close emits **close**. Meta row shows **核数** / **aic频率** / **NPU ARCH** only when set; hides when none. **`ratedFreq` omitted** from shell. **更多** when meta visible or `hardwareDetails` capability.

### Mode switcher

Shows available modes only (hide empty). Default = first available.

### Summary cards

I-Q6a thin tiles only. Card group renders when `taskDurationUs` is present (name/type alone do not open an empty grid).

**Duration card (整体耗时).** Localized label; large primary value from formatted `taskDurationUs`; thin decorative progress track with a fixed short cyan fill (`--pr-color-duration-bar`) — visual chrome only, **not** a utilization scale (I-Q6e). Secondary line (I-Q6e): if `blockDim` is set, show iterations/core style text; else fall back to `opName`; omit secondary if neither.

Do **not** render a standalone op-type card. Do **not** render compute / input BW / output BW / avg core util cards until Product Q6.

**PIPE.** Matches [`pipe-bars.png`](./PipeOccupancyPanel/visual/pipe-bars.png). Values are per-family means of non-NA ratios (I-Q6b). Bar colors match COLOR_TOKENS.

Section header shows localized **pipeOccupancy** title and a **详情** / Details control that switches to compute mode when tables exist and emits **open-pipe-details**. A 0%–100% scale sits above the rows. Each row: label, track with solid fill for ratio and hatched remainder to 100%, optional in-bar absolute from `absoluteValue` (I-Q6f mean `*_time(us)`), and a right-aligned percent.

**Cube | Vector toggle.** When `summary.opType` is MIX (case-insensitive), show a Cube|Vector segmented control and filter `pipeOccupancy` by `side` (`cube` / `vector`). Each bar uses only that side’s CSV columns (`aic_*` vs `aiv_*`). Non-MIX with a known side (cube/aic or vector/aiv/vec): no toggle; show pipes for that side only. When `opType` is blank or unrecognized: no toggle; show all PIPE bars (do not default-filter to vector).

**Compute / Memory.** Hosts `CsvFieldListPanel` with tabs, block switcher, search, 查看全部.

### Roofline (M2 interim)

When `report.roofline.points` is non-empty, mount `RooflinePanel` below the active mode panel (I-Q11a–f). Hide when absent. No tabs until I-Q11f superseded.

### Hardware details (M1 interim I-Q7a)

**更多** opens an overlay with `HardwareDetailsPanel` when `hardwareDetails` is present (and emits `open-hardware-details`). Header **←** returns to mode panels. CSV Pipe/Memory drill-downs use the mode switcher (not a separate surface).

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
15. **PR-STATS-015** — Roofline section when `roofline.points` present; hidden when absent.
16. **PR-STATS-016** — 详情 switches to compute mode when compute tables exist and emits open-pipe-details.
17. **PR-STATS-017** — Memory mode shows memory CSV panel when tables present.
18. **PR-STATS-018** — 更多 navigates to hardware overlay when hardwareDetails present; back returns.

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
| No roofline / empty points | Roofline section omitted |

## Visual

Crops (shell): [`visual/aside-scrolled.png`](./visual/aside-scrolled.png) — [`visual/provenance.yaml`](./visual/provenance.yaml). Child packs: [`PipeOccupancyPanel`](./PipeOccupancyPanel/visual/), [`StatsSummaryPanel`](./StatsSummaryPanel/visual/), [`HardwareDetailsPanel`](./HardwareDetailsPanel/visual/).

## Design sketches

- [aside-scrolled](./visual/aside-scrolled.png) — from `v930/report-stats-scrolled`
- [mode-tabs](./PipeOccupancyPanel/visual/mode-tabs.png) — Cube|Vector tabs from `v930/compute-load`
- [summary-cards](./StatsSummaryPanel/visual/summary-cards.png) — from `v930/report-stats-open`
- [pipe-bars](./PipeOccupancyPanel/visual/pipe-bars.png) — from `v930/compute-load`
- [hardware-detail](./HardwareDetailsPanel/visual/hardware-detail.png) — from `v930/hardware-more-detail`
- [compute-load-detail](../../../docs/ui/source/v930/compute-load-detail.jpeg) — compute CSV tabs
- [memory-load-detail](../../../docs/ui/source/v930/memory-load-detail.jpeg) — memory tabs + block
- [PIPE occupancy](../../../docs/ui/source/v930/compute-load.jpeg) — full frame

## Dependencies

[COLOR_TOKENS.md](../../../docs/ui/COLOR_TOKENS.md), [view-models](../../../specs/core/view-models.spec.md), [INTERACTIONS.md](../../../docs/ui/INTERACTIONS.md), I-Q6a/b/c/d/e/f, I-Q7a, I-Q11a–f.

## Changelog
- **2026-08-10** — Hardware overlay via 更多 (PR-STATS-018, I-Q7a); PIPE 详情 → compute mode (PR-STATS-016).
- **2026-08-10** — Roofline section when points present (PR-STATS-015, I-Q11*).
- **2026-08-07** — PIPE sketch chrome: scale, hatch, absolute time, Details (PR-STATS-012–014, I-Q6f).
- **2026-08-07** — Duration card chrome I-Q6e (PR-STATS-009–011).
- **2026-08-07** — Shell close/meta/更多 (PR-STATS-006–008).
- **2026-08-07** — Mode switcher + compute/memory CSV panels (PR-STATS-005).
- **2026-08-07** — Unrecognized opType shows all PIPE sides; PR-STATS-004.
- **2026-08-07** — Cube|Vector toggle on existing PIPE panel only.
- **2026-08-05** — Initial spec.

## Open

Q22 — measureRange aside sync.
