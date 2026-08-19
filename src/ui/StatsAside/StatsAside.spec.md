# StatsAside

| spec-id-prefix |
|----------------|
| PR-STATS-*   |

Right-side analytics panel: shell chrome (title, close, meta, 更多), stacked 报告统计 scroll (duration, roofline, PIPE, topology), and full-panel overlays for compute CSV, memory CSV, and hardware details.

## Inputs

**report** — `ReportViewModel` including `computeTables`, `memoryTables`, `csvTexts`, optional `roofline`, optional `memoryTopology`, and optional `hardwareDetails`. Optional **locale**. Optional **capabilities** (e.g. `hardwareDetails`) gates shell controls that need feature flags.

## Outputs

- **close** — aside close control; parent clears `asideVisible`.
- **open-hardware-details** — **更多** / More (emit intent).
- **view-full-csv** — re-emitted from `CsvFieldListPanel` (I-Q6d).
- **open-pipe-details** — **详情** / Details on the PIPE section; opens compute CSV overlay when compute tables exist, and always emits.

## Behavior

### Shell (header chrome)

Localized **summary** title with decorative chart icon. Close emits **close**. Meta row shows **核数** / **aic频率** / **NPU ARCH** only when set; hides when none. **`ratedFreq` omitted** from shell. **更多** when meta visible or `hardwareDetails` capability.

Overlay surfaces replace the stacked report: header title becomes **计算负载分析** / **内存负载分析** / **硬件信息详情**; **←** returns to the stack. No mode-tab switcher on the stacked report. Header stays pinned; stacked body and overlay lists scroll in the remaining height.

### Stacked report

Default surface stacks, hide-if-missing, in order: duration card, I/O bandwidth cards (I-Q6g), Roofline, PIPE (计算负载分析), memory topology (内存负载分析). No Summary | PIPE | Compute | Memory tabs.

### Summary cards

I-Q6a duration + I-Q6g bandwidth. Card group renders when `taskDurationUs` **or** `bandwidthCards` is present (name/type alone do not open an empty grid).

**Duration card (整体耗时).** Localized label; large primary value from formatted `taskDurationUs`; thin decorative progress track with a fixed short cyan fill (`--pr-color-duration-bar`) and hatched remainder — visual chrome only, **not** a utilization scale (I-Q6e). Secondary line (I-Q6e): if `blockDim` is set, show iterations/core style text; else fall back to `opName`; omit secondary if neither.

Do **not** render a standalone op-type card. Do **not** render compute / avg core util cards until Product Q6.

**I/O bandwidth (I-Q6g).** `bandwidthCards` from Memory.csv. Same card chrome as duration (`summary-cards.png`). Each card (输入/输出) is a **pair of aic | aiv columns**: large score (same `20px` value style, no `%`), `aic`/`aiv` label to the right of the number, bar fill = score % of track (`--pr-color-overview-cube`, same 6px hatched track), subtitle `measured / peak TB/s` (GB/s ÷ 1000, magnitude rounding). Peak is adapter-supplied (max of Memory.csv main-mem BW). Hide a side when all-NA; hide the card when both sides NA. Cards stack full-width under duration (aside is ~360px; sketch 3+2 outer grid would squeeze inner columns). Do not show cards from `summary.ioBandwidth` alone.

**PIPE.** Matches [`pipe-bars.png`](./PipeOccupancyPanel/visual/pipe-bars.png). Values are per-family means of non-NA ratios (I-Q6b). Bar colors match COLOR_TOKENS. Section title **计算负载分析**. **详情** opens the compute CSV overlay when tables exist and emits **open-pipe-details**. A 0%–100% scale with dotted vertical grid sits above the rows — 0% left-aligned to the track start, 100% right-aligned to the end, 20/40/60/80 centered on those marks. Each row: label (ellipsis if wider than the column), track with solid fill for ratio and hatched remainder to 100%, optional in-bar absolute from `absoluteValue` (I-Q6f) that may paint over the hatch when the fill is narrower than the digits, and a right-aligned percent.

**Cube | Vector toggle.** When `summary.opType` is MIX (case-insensitive), show a Cube|Vector segmented control and filter `pipeOccupancy` by `side` (`cube` / `vector`). Each bar uses only that side’s CSV columns (`aic_*` vs `aiv_*`). Non-MIX with a known side (cube/aic or vector/aiv/vec): no toggle; show pipes for that side only. When `opType` is blank or unrecognized: no toggle; show all PIPE bars (do not default-filter to vector).

**Roofline (M2 interim).** When `report.roofline.points` is non-empty, mount `RooflinePanel` on the stack after the summary cards (I-Q11a–f). Hide on overlays and when absent. No tabs until I-Q11f superseded.

**Topology (M2).** When labelled edges exist, mount `MemoryTopologyPanel` below PIPE with title **内存负载分析** and **详情**. **详情** opens the memory CSV overlay. If memory tables exist but the current block has no labelled edges, still show the section chrome + **详情** (no diagram) so the overlay stays reachable. Labels are block-scoped: parent owns `selectedBlockId` and rebuilds via `buildMemoryTopology`. Hide the diagram when the model is absent. On **report** change, re-pick `selectedBlockId` via `firstLabelledMemoryTopology` (do not keep a stale id that is unlabelled in the new file).

**CSV-only fallback.** If duration, bandwidth, PIPE, roofline, and topology are all absent but compute/memory tables exist, show those CSV lists on the stack (no overlay required).

**Compute / Memory overlays.** Hosts `CsvFieldListPanel` with tabs, block switcher, search, 查看全部. Overlay body fills the column under the header; the field list scrolls (no inner max-height cap).

### Hardware details (M1 interim I-Q7a)

**更多** opens an overlay with `HardwareDetailsPanel` when `hardwareDetails` is present (and emits `open-hardware-details`). Header **←** returns to the stacked report.

## Acceptance Criteria

1. **PR-STATS-001** — Renders summary stats.
2. **PR-STATS-002** — Renders PIPE bars with correct colors.
3. **PR-STATS-003** — Cube|Vector toggle appears only for MIX; filters bars by side.
4. **PR-STATS-004** — Blank or unrecognized `opType` shows all PIPE sides.
5. **PR-STATS-005** — PIPE 详情 overlay shows compute CSV tabs and emit `view-full-csv`; topology 详情 shows memory CSV.
6. **PR-STATS-006** — Header title and close emit.
7. **PR-STATS-007** — Meta hide-if-missing.
8. **PR-STATS-008** — More emits open-hardware-details.
9. **PR-STATS-009** — Duration card sketch chrome.
10. **PR-STATS-010** — No type card; secondary hide-if-missing.
11. **PR-STATS-011** — Compute/util cards absent; BW not from `summary.ioBandwidth`.
12. **PR-STATS-012** — PIPE scale and hatched bars.
13. **PR-STATS-013** — Absolute time in bar when present.
14. **PR-STATS-014** — Details emit open-pipe-details.
15. **PR-STATS-015** — Roofline section when `roofline.points` present; hidden when absent.
16. **PR-STATS-016** — PIPE 详情 opens compute overlay when compute tables exist and emits open-pipe-details.
17. **PR-STATS-017** — Topology 详情 shows memory CSV overlay when tables present.
18. **PR-STATS-018** — 更多 navigates to hardware overlay when hardwareDetails present; back returns.
19. **PR-STATS-019** — Topology section when `memoryTopology` has labelled edges; hidden when absent.
20. **PR-STATS-020** — No mode-tab switcher on the stacked report.
21. **PR-STATS-021** — Overlay returns to stack when report changes or overlay data disappears; `selectedBlockId` re-picks the first labelled block of the new report.
22. **PR-STATS-022** — Topology labels follow the selected block; no first-block fallback; CSV tab switch does not rewrite the bound id.
23. **PR-STATS-023** — Memory 详情 is available when memory tables exist even if the topology diagram is hidden.
24. **PR-STATS-024** — I/O bandwidth cards: aic|aiv columns, duration chrome, TB/s, bar = score%.

## Edge Cases

| State | Behavior |
|---|---|
| report is null or undefined | Empty panel, no error; title + close still shown |
| Empty pipeOccupancy | No bars; summary still visible if present |
| Non-MIX known opType | No Cube|Vector toggle; side-filtered bars |
| Blank/unrecognized opType | Show all PIPE bars |
| Missing compute/util (I-Q6a) | Those cards absent |
| `summary.ioBandwidth` only | No BW cards (need `bandwidthCards`) |
| Bandwidth side all NA | That aic/aiv column omitted; card omitted if both sides NA |
| Duration without blockDim or opName | Duration card; no secondary line |
| No meta fields and no `hardwareDetails` | Meta row and 更多 hidden |
| Meta fields present, no capability | Meta + 更多 shown; emit only |
| Absolute time all NA | Bar shows ratio/% only; no in-bar absolute |
| No roofline / empty points | Roofline section omitted |
| No memoryTopology | Topology section omitted |
| Selected block has no labelled edges | Topology diagram hidden; 详情 remains if memory tables exist |
| Overlay open, report replaced | Return to stacked report; re-pick first labelled block |
| CSV tables only | Compute/memory lists on the stack |

## Visual

Crops (shell): [`visual/aside-scrolled.png`](./visual/aside-scrolled.png) — [`visual/provenance.yaml`](./visual/provenance.yaml). Child packs: [`PipeOccupancyPanel`](./PipeOccupancyPanel/visual/), [`StatsSummaryPanel`](./StatsSummaryPanel/visual/), [`HardwareDetailsPanel`](./HardwareDetailsPanel/visual/).

Sampled from `v930/report-stats-open` / `v930/report-stats-scrolled` (aside column). Toolbar-style token tables.

### Shell

| Token | Value |
|-------|--------|
| Background | `#262626` (`--pr-bg-panel`) |
| Padding | `10px 12px` |
| Title | `13px` / `600` / `#ffffff` |
| Chart icon | `14×14` stroke polyline, `#c8c8c8` |
| Close / back | `16px` / `#e6e6e6` |
| Meta | `11px` / `#a8a8a8` |
| 更多 / 详情 | `11px` / `#9a9a9a` (not playhead blue) |
| Header | pinned (`flex-shrink: 0`); body / overlay `flex: 1; min-height: 0; overflow` |

### Duration card (`summary-cards.png` cell)

| Token | Value |
|-------|--------|
| Radius | `4px` |
| Border | `1px solid #3a3a3a` |
| Padding | `10px 12px` |
| Label | `11px` / `#9a9a9a` |
| Value | `20px` / `600` / `#ffffff` |
| Bar height | `6px`; fill `--pr-color-duration-bar` ~12%; hatched remainder `#2a2a2a` / `#1f1f1f` |
| Sub | `11px` / `#8a8a8a` |

### I/O bandwidth cards (`summary-cards.png`)

Same card chrome as duration. Cards stack in one column (aside width). Sketch 3+2 outer grid is not used — compute/util hidden and ~360px aside cannot fit aic\|aiv plus `measured / peak TB/s` in a half-width card.

| Token | Value |
|-------|--------|
| Inner | `aic` \| `aiv` columns (`repeat(auto-fit, minmax(0, 1fr))`, gap `8px`) |
| Score | same Value token; no `%` |
| Side label | `11px` / `#9a9a9a`, baseline-aligned to the right of the score |
| Bar | same 6px hatched track; fill `--pr-color-overview-cube` = score % of track |
| Sub | same Sub token: `measured / peak TB/s` |

### PIPE (`pipe-bars.png`, `mode-tabs.png`)

| Token | Value |
|-------|--------|
| Panel | inset `#1f1f1f`, radius `4px`, padding `10px` |
| Title | `12px` / `600` / `#ffffff` — **计算负载分析** |
| Cube\|Vector | pill bg `#1a1a1a`; active `#3a3a3a` / `#ffffff`; inactive `#9a9a9a`; radius `4px` |
| Bar height | `16px`; radius `4px` |
| Grid | dotted `#3a3a3a` at 0/20/…/100%; scale ticks on those marks |
| Fills | COLOR_TOKENS `colorKey` |
| Short-bar abs | overflow onto hatch; do not clip |

## Design sketches

- [aside-scrolled](./visual/aside-scrolled.png) — from `v930/report-stats-scrolled`
- [mode-tabs](./PipeOccupancyPanel/visual/mode-tabs.png) — Cube|Vector tabs from `v930/compute-load`
- [summary-cards](./StatsSummaryPanel/visual/summary-cards.png) — from `v930/report-stats-open`
- [pipe-bars](./PipeOccupancyPanel/visual/pipe-bars.png) — from `v930/compute-load`
- [hardware-detail](./HardwareDetailsPanel/visual/hardware-detail.png) — from `v930/hardware-more-detail`
- [compute-load-detail](../../../docs/ui/source/v930/compute-load-detail.jpeg) — compute CSV overlay
- [memory-load-detail](../../../docs/ui/source/v930/memory-load-detail.jpeg) — memory overlay
- [PIPE occupancy](../../../docs/ui/source/v930/compute-load.jpeg) — full frame

## Dependencies

[COLOR_TOKENS.md](../../../docs/ui/COLOR_TOKENS.md), [view-models](../../../specs/core/view-models.spec.md), [INTERACTIONS.md](../../../docs/ui/INTERACTIONS.md), I-Q6a/b/c/d/e/f/g, I-Q7a, I-Q11a–f.

## Changelog

- **2026-08-19** — BW cards match `summary-cards.png` inner aic\|aiv columns and duration chrome; cards stay 1-col (aside width).
- **2026-08-19** — PR-STATS-024 asserts score via `data-testid`; peak is adapter max (I-Q6g).
- **2026-08-19** — I/O bandwidth cards I-Q6g (PR-STATS-024); PR-STATS-011 still hides compute/util.
- **2026-08-14** — CSV tab switch does not rewrite topology block (PR-STATS-022).
- **2026-08-13** — Memory 详情 without diagram (PR-STATS-023); re-pick labelled block on report swap (PR-STATS-021).
- **2026-08-13** — Stacked 报告统计; 详情/更多 overlays; drop mode tabs; topology section (PR-STATS-019–022).
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

Q22 — measureRange aside sync. Q6 — peak/score for bandwidth still Product-open (I-Q6g guesses).
