# StatsAside

| spec-id-prefix |
|----------------|
| PR-STATS-*   |

Right-side analytics panel: shell chrome (title, title-row **性能分析** link when hints exist, title-row **执行优化** pill, close on the report shell only, meta, 更多), stacked 报告统计 scroll (duration, roofline, PIPE, topology), and full-panel overlays for compute CSV, memory CSV, and hardware details. Each report section's CANNWork action entry is a **three-state button group** ([CannbotActions](./CannbotActions.vue)) driven by the host-pushed session state.

## Inputs

**report** — `ReportViewModel` including `computeTables`, `memoryTables`, `csvTexts`, optional `roofline`, optional `memoryTopology`, optional `memoryHeatmap`, and optional `hardwareDetails`. Optional **locale**. Optional **capabilities** — this component reads **`roofline`** (mounts the Roofline card when the capability is present), **`archDiagram`** (emulate Architecture Diagram metric-mode dropdown + rebuild from ArchDiagramMetrics; PR-STATS-037) and **`memoryHeatmap`** (the stacked diagram's five heat units become clickable targets; PR-STATS-043). The hardware-details overlay is **not** flag-gated: it keys off `report.hardwareDetails` (`hasHardwareDetails`). Optional **cannbotSessions** — latest cannbot session per scope (`CannbotSessions`, [cannbot contract](../../../specs/core/cannbot-payload.spec.md)); a missing key (or a host that never pushes sessions — browser / playground / exported HTML) leaves that scope **idle**. The prop is the **single source** of button state: the aside derives nothing and stores nothing.

**Data SSOT:** [docs/views/](../../../docs/views/) — [report-summary](../../../docs/views/report-summary.md), [pipe-occupancy](../../../docs/views/pipe-occupancy.md), [roofline](../../../docs/views/roofline.md), [memory-topology](../../../docs/views/memory-topology.md).

## Outputs

- **close** — aside close control on the **report** shell only; parent clears `asideVisible`. Overlay headers omit it.
- **open-performance-hints** — title-row **性能分析** link (report shell only; left of close × when `performanceHints` capability + rows). Parent environment-routes to Problems or the internal dock.
- **perform-optimization** — title-row **执行优化** pill (icon + label), immediately left of close ×. Emit intent only; the host activates CANNWork. Not part of the session state machine — it never writes or reads `cannbotSessions`.
- **open-hardware-details** — **更多** / More (emit intent).
- **view-full-csv** — re-emitted from `CsvFieldListPanel` (DATA-33d).
- **open-pipe-details** — the PIPE section head's **detail entry**: the section title (计算负载分析) + right-pointing chevron form **one clickable button** (`data-testid="pipe-details"`) — title text, chevron and the gap between them all open the compute CSV overlay when compute tables exist, and always emit. There is no separate **详情** text button.
- **open-topology-fullscreen** — the panel bar's **全屏** control (`title`/`aria-label` **全屏** / Full screen, `MemoryTopologyPanel` **showFullscreen**), re-emitted for the parent, which covers `.pr-root` with the current topology model. Does not open the memory CSV overlay. Carries an optional second argument: the §11.2.3.2 **heat unit** clicked on the stacked diagram (PR-STATS-043), so the parent opens 全屏 already showing that unit — 点击一个 memory 进来则直接对应显示相应的内容.
- **open-cannbot** — the scope's 分析 button click (idle or settled state) carries the section scope (summary/compute/memory).
- **open-cannbot-stop** — the scope's **正在分析** button click (running state): host stops the session. The button itself is `data-testid="cannbot-{scope}"`, so the same selector that clicks idle 分析 clicks running 停止.
- **cannbot-reference** — the scope's **引用** button (`data-testid="cannbot-{scope}-reference`). **引用常驻**: it renders in every state (idle / running / settled), immediately right of the 分析 / 正在分析 button. The add-reference api is not ready yet, so the host's handler is a placeholder.
- **cannbot-view** — settled scope's **查看** button (`data-testid="cannbot-{scope}-view`).

## Behavior

### Shell (header chrome)

Localized **summary** title with decorative chart icon (L-axis + sparkline). When the report carries performance hints (`performanceHints` capability + rows), a **性能分析** text link sits in the title row immediately left of close ([`aside-hints-title-row.png`](./visual/aside-hints-title-row.png)); it emits **open-performance-hints**. The **执行优化** pill (cannwork-optimize icon + label) sits in the same title row immediately left of close (PR-STATS-045); clicking emits **perform-optimization** — no overlay, no request, the host decides what to do. Close emits **close** — report shell only. Meta row shows **进程** / **算子类型** / **Blocks** from `pid` / `opType` / `blockDim`; label muted, value lighter; hides a segment when unset. **aic频率**, **Rated Freq**, 核数, and NPU ARCH are not on this shell. **更多** always on the report shell (UI-30, UI-31).

Overlay surfaces replace the stacked report: header title becomes **计算负载分析** / **内存负载分析** / **硬件信息详情**; the back control returns to the stack. Close and the **性能分析** link are **omitted** on overlay headers so × cannot dismiss the whole aside while drilled in. No mode-tab switcher on the stacked report. Header stays pinned; stacked body and overlay lists scroll in the remaining height.

**cannbot entries (three-state button group, [`CannbotActions`](./CannbotActions.vue)).** One group per scope at the three anchors: right end of the meta row (summary), right of the section head on the compute and memory sections. Each follows its host — summary with the meta row, compute with the PIPE panel, memory with the memory panel; the memory group stays even when that head has no drill-in entry. Button state is **per-scope independent**, derived only from `cannbotSessions[scope]`:

- **idle** (no key — never started, or the host pushed nothing): **分析 | 引用** — the 分析 button (multi-colour `cannwork-analyse` icon, localized `cannbotAsk` title / `aria-label`) plus the always-on 引用 button. Clicking 分析 emits **open-cannbot**; 引用 emits **cannbot-reference**.
- **running** (`status === 'running'`): **正在分析 | 引用** — the stop button (`cannwork-stop` glyph + localized `cannbotAnalyzing` label 正在分析 in blue `#4c9ff8`, full opacity: the live state, not an affordance) plus the always-on 引用 button. No 分析 / 查看 buttons. Clicking 正在分析 emits **open-cannbot-stop**.
- **settled** (`status` present and not `running`: completed / stopped / error / unknown): three pure-icon buttons **分析 | 引用 | 查看** in one pill — `cannbot-actions--settled` joins them with 1px hairline dividers (`rgba(255,255,255,0.14)`) and flat inner radii. 分析 still emits **open-cannbot**; 引用 (`cannbot-{scope}-reference`, `cannwork-reference` icon) emits **cannbot-reference**; 查看 (`cannbot-{scope}-view`, `cannwork-report` icon) emits **cannbot-view**.

**引用常驻 rationale.** 引用 is a pure-icon button that never disappears, so a row always has ≥2 buttons and the hairline separators read as one pill. Keeping it in idle / running also lets the user attach a reference before or during an analysis; the CANNWork add-reference api is not available yet, so the host currently logs a placeholder. This deliberately diverges from the first UI draft (single 分析 in idle, single 正在分析 in running) — the code is the reference; the requirement design doc was updated to match.

The `data-testid="cannbot-{scope}"` slot always lands on whichever button exists in the current state (idle 分析 / running 停止 / settled 分析), so the same selector reaches the primary action in every state. Clicking only emits — no overlay, no request; the invoking is the host's job.

### Stacked report

Default surface stacks, hide-if-missing, in order: summary card grid (sketch **2×2**; one tile per row below a **430px** well — PR-STATS-036), Roofline (only with the `roofline` capability), PIPE (计算负载分析), memory topology (内存负载分析). No Summary | PIPE | Compute | Memory tabs.

### Summary cards

DATA-33a duration + DATA-8 bandwidth + DATA-33h compute. Card group renders when `taskDurationUs` **or** `bandwidthCards` is present (name/type alone do not open an empty grid).

**Sketch grid (`summary-cards.png`, v930 refresh).** **2×2**: top **整体耗时** | **AICore 并行使用率**; bottom **算力情况** | **带宽利用率**. Do **not** render a standalone op-type card. When duration is present and a card’s data/formula is missing, that cell is title + `N/A` (keeps the grid rectangular). BW-only summaries (no `taskDurationUs`) omit duration-gated placeholders. The aside is user-resizable (**280–720**) and the grid follows it: **below a 430px content well the 2×2 collapses to one tile per row** (PR-STATS-036). Two tiles at that width leave each side column ~36px — too little for any label — while a single tile returns the whole well to the card. The **2×2** sketch chrome holds at every width that fits it (the default **480** aside included).

**Tile text never crops silently (PR-STATS-036).** Every label inside a tile has a defined overflow behavior, so resizing the aside cannot hide or paint over text:
- **Card label + duration secondary** wrap inside the tile. The secondary carries a rounded value and falls back to `opName` (DATA-1), which has no break opportunity — it breaks mid-token rather than leaving the tile.
- **Column label** (side label) sits beside the score while the two fit on one line and drops to its own line under the score when they do not. **Every** column label — AICore 并行使用率 / 负载均衡度, compute Cube / Vector, BW 读 / 写 — opens the shared card tooltip (PR-STATS-041) carrying its full text while its column actually cuts it (`scrollWidth > clientWidth`), so a fully visible label is not echoed back at the user.
- A column narrower than the label **itself** (one word wider than the column) ellipsizes it, against that tooltip. Truncation is never silent: an ellipsis always has a tooltip.

**Duration card (整体耗时).** Localized label; large primary value from formatted `taskDurationUs` with the unit as a muted sibling (sketch `4.60` + `ms`). Display always uses **2 decimal places**; the value cell opens the shared card tooltip (PR-STATS-041) whose **first line is the exact value** (`准确值` / `Exact value`) — residue-stripped through `exactNumber()` — and whose **second line describes the metric** (整体耗时 / Task Duration) (PR-STATS-009c, PR-STATS-040). **Bar (UI-32, 2026-10-21 mock):** when `summary.durationBreakdown` is present, a 3-segment composition (头开销 / 计算 / 通信) sized by those µs shares, legend under the track, and a hover list teleported to `body` — **计算时间 / 通信时间 / 通算重叠时间 / 头开销时间** only (no 迭代/核; sketch typo `头开销时间时间` → **头开销时间**). Value-row Blocks/核 secondary is **omitted** while the bar is shown. When breakdown is absent: **no bar**; value-row secondary (UI-32 / DATA-1) `{blockDim} Blocks / {coreCount} 核` when both set; else `{blockDim} Blocks`; else `opName`; omit if neither. Visual: [`duration-card.png`](./StatsSummaryPanel/visual/duration-card.png) / [`duration-card-tooltip.png`](./StatsSummaryPanel/visual/duration-card-tooltip.png).

**AICore 并行使用率 (DATA-9 / DATA-10).** Dual columns **并行使用率** | **负载均衡度** from `summary.parallelUtilization` / `parallelBalance` (fractions → `%`). Large score **with** `%` at **2 decimal places** (fraction fields keep sub-percent precision; unlike compute/BW integer `utilScore` ratios). Bar = same clamped score % of track. Clamp display score to **[0, 100]** so label and bar stay in lockstep when balance `1−σ/μ` goes negative or util exceeds 1; the value cell's shared tooltip leads with the unrounded `fraction×100` percent, float residue stripped at **4 significant digits** (PR-STATS-042) (`准确值` / `Exact value`), then **describes the metric** (并行使用率 / 负载均衡度 with its `summary.jsonl` field) (PR-STATS-011c, PR-STATS-040). Column label beside the score while the two fit on one line, else on its own line under the score; ellipsis + shared tooltip when the column is narrower than the label itself (same chrome as BW 读\|写; PR-STATS-036). Hide a column when its field is absent; title + `N/A` when duration is present but both absent. Omit the card when BW-only (no `taskDurationUs`). Do not bind `summary.avgCoreUtil`.

**算力情况 (DATA-33h).** `computeCard` from adapter. Inner **Cube \| Vector** columns (UI-33; adapter sides `aic`/`aiv`). Large score (**no** `%`) whose shared tooltip leads with the precise percent (`准确值` / `Exact value`), then names the side and reads as *measured throughput ÷ theoretical peak* (PR-STATS-040), bar fill = score % of track (8px pill hatched track; `min-width: 0` at 0%; distinct fill hues per side in the sketch), subtitle `measured / peak` with `TFLOPS` on the next line whose shared tooltip leads with the raw values (binary-float residue stripped, **4 significant digits**; PR-STATS-042), then describes the ratio (PR-STATS-040). The printed score and bar clamp to **[0, 100]** while the tooltip keeps the true percent, on the same rule as AICore 并行使用率 (PR-STATS-011c). Requires `taskDurationUs`. Hide a side when measured or peak is missing; show **N/A** when duration is present but `computeCard` is absent. Do not bind `summary.computeTflops`.

**带宽利用率 (DATA-8, sketch).** One card with **读 \| 写** columns (replaces separate 输入/输出 × aic|aiv cards). Large score **with** `%`, clamped to **[0, 100]** with the true percent kept in its tooltip (same rule as 算力情况 / AICore), whose shared tooltip leads with the precise percent (`准确值` / `Exact value`), then reads as *measured direction bandwidth ÷ theoretical peak* (PR-STATS-040), bar = score % of track, subtitle `measured / peak` throughput whose shared tooltip leads with the raw values (binary-float residue stripped, **4 significant digits**; PR-STATS-042), then describes the ratio (PR-STATS-040). Display unit **GB/s** (UI-34; sketch still prints TB/s). Peak = `OpInfoSummary.aicore_gm_bw_theoretical(GB/s)` = SOL **1600 GB/s**, shared by both sides (DATA-6). Measured read / write = the producer's summed sides (`aicore_gm_read_bw` / `aicore_gm_write_bw`; the `Memory` per-side rows are the classic-`.rep` fallback, DATA-8); each direction's score = that direction's measured ÷ peak. The card does not use `aicore_gm_bw_usage_rate(%)` (a mean of the per-path usage columns). Hide a column when all-NA; hide the card when both NA. Do not show cards from `summary.ioBandwidth` alone.

**PIPE.** Matches [`pipe-bars.png`](./PipeOccupancyPanel/visual/pipe-bars.png). Values are per-family means of non-NA ratios: `All` reads `summary.jsonl` `PipeUtilization` (the producer's non-`NA` mean across `block_id`), a picked id reads that block's `PipeUtilization.csv` row — one block selector (**All \| id**, default **All**) for the whole aside ([DATA-19](../../../docs/context/decisions/DATA.md) / [DATA-28](../../../docs/context/decisions/DATA.md) / [DATA-29](../../../docs/context/decisions/DATA.md)). The same selection scopes the memory topology, the BW cards, the compute card, the roofline and the 详情 lists; picking an id updates every one of them, and **All** returns them all to the `summary.jsonl` aggregate. Without `summary.jsonl` (classic `.rep`) `All` falls back to the CSV data. `HardwareInfo` / `OpInfoSummary`-only fields (AI Core 并行使用率 / 负载均衡度) are op-level and do not change with the selection. Switcher ids are every `block_id` in the report (compute ∪ memory, fixture order), so the aside switcher and the memory overlay switcher share one option list and cannot disagree. Bar colors match COLOR_TOKENS. Section title **计算负载分析** — the title + chevron button is the **详情** entry: it opens the compute CSV overlay when tables exist and emits **open-pipe-details** (PR-STATS-046: 1s cooldown on the click). A picked block never renders the **All** aggregate under its own label: a widget with no data for that id blanks (BW card / roofline hidden, compute card **N/A**, PIPE rows empty, topology unlabelled) while the switcher stays reachable. A 0%–100% scale with 20/40/60/80 grid overlays sits above the rows — 0% left-aligned to the track start, 100% right-aligned to the end, 20/40/60/80 centered on those marks. Each row: label (ellipsis if wider than the column), track with solid fill for ratio and a `colorKey`-tinted hatched remainder to 100%, optional in-bar absolute from `absoluteValue` (DATA-33f) that may paint over the hatch when the fill is narrower than the digits, and a right-aligned percent inside the track.

**Cube | Vector toggle.** When `summary.opType` is MIX (case-insensitive), show a Cube|Vector segmented control and filter `pipeOccupancy` by `side` (`cube` / `vector`). Each bar uses only that side’s CSV columns (`aic_*` vs `aiv_*`). Non-MIX with a known side (cube/aic or vector/aiv/vec): no toggle; show pipes for that side only. When `opType` is blank or unrecognized **and** occupancy is compute-shaped (`cube`/`vector` only): no toggle; show all PIPE bars (do not default-filter to vector).

**Cube | Vector 0 | Vector 1 toggle ([UI-54](../../../docs/context/decisions/UI.md)).** When `pipeOccupancy` includes ≥2 of `side` `aic` / `aiv0` / `aiv1` (emulate hist/cores), show the same segmented-control chrome labeled **Cube | Vector 0 | Vector 1** and filter bars by the active core. Default active side = first present in order `aic`, `aiv0`, `aiv1`. A **single** emulate core side still shows that core's bars (no toggle) and must **not** fall through to compute `knownSide` (`aic`→cube / `aiv*`→vector), which would blank the list. Compute MIX Cube|Vector is unchanged and mutually exclusive with this emulate path in practice (sides do not mix).

**Roofline (npu-compute §11.8).** The card mounts on the stack after the summary cards when the `roofline` capability is present **and** the current points are non-empty (`report.roofline.points` under **All**, block-scoped model for a picked block). A picked block rebuilds only the GM point + mix from that block's CSV rows and **keeps** the All model's chip-level `series` roofs **and** non-`gm` measured points (HardwareInfo Roofline). The adapter derives the capability when points exist; a host `capabilities` prop overrides wholesale. Hide on overlays and when absent. No tabs (DATA-37f).

**Topology (M2).** When the current model is drawable — a value on a plated edge, or the L2 plate (`l2.peakPct` / `l2-hit`), per `hasDrawableTopology` (PR-VM-018) — mount `MemoryTopologyPanel` below PIPE with title **内存负载分析**, and **详情**. Action order: cannbot → **详情** (the section title + chevron is the 详情 entry; same rule as PIPE). The **全屏** control is not in the header: it is the last control of the panel's own zoom/fullscreen bar ([MemoryTopologyPanel](./MemoryTopologyPanel/MemoryTopologyPanel.spec.md) PR-MEMTOP-014), which this aside turns on with **showFullscreen** and whose `open-fullscreen` it re-emits as **open-topology-fullscreen** (parent covers `.pr-root` with the current `topologyModel`, i.e. the active block scope). **详情** and **right-click** on the stacked diagram (UI-35) open the memory CSV overlay. If memory tables exist but the current block is not drawable — no label at all, or labels only on plated-less edges (`l0c-l1` / `l0c-l2` KB, `l2-l1-write` pending UI-48) — still show the section chrome + **详情** (no diagram, so no bar and no **全屏**) so the CSV overlay stays reachable. Labels follow the shared block selector (`blockId`): **All** reads the `summary.jsonl` category mean, a picked id rebuilds via `buildMemoryTopology(tables, id)` ([DATA-19](../../../docs/context/decisions/DATA.md) / [DATA-29](../../../docs/context/decisions/DATA.md)); `tables` is the report's Memory* CSVs **plus** `PipeUtilization.csv`, which feeds the in-box unit badges (UI-49) and is inert for the link labels. L2 Peak(%) comes from `l2.peakPct` (DATA-20, resolved: the L2 plate carries the hit rate; no other unit has a Peak), and the in-box **Scalar / Vec / Cube** utilizations come from `plates` (UI-49, resolved; AIV0/AIV1 share one field, the four field-less badge positions stay blank). Hide the diagram when the model is absent. On **report** change the selection resets to **All** (nothing stale carries over); `firstLabelledMemoryTopology` still supplies the adapter snapshot for a classic `.rep` with no `summary.jsonl` (PR-VM-012).

**CSV-only fallback.** If duration, bandwidth, PIPE, roofline, and topology are all absent but compute/memory tables exist, show those CSV lists on the stack (no overlay required).

**Compute / Memory overlays.** Hosts `SummaryCategoryList` (All / `summary.jsonl`) or `CsvFieldListPanel` (picked block). Both surfaces show tabs + search + match chips (UI-43). Compute CSV path (`v930/compute-load-detail`, `v930/search-highlight`): no block picker, no 查看全部. When `PipeUtilizationHist.csv` is present, the adapter projects Utilization onto sparse `aic_*` / `aiv0_*` / `aiv1_*` `*_ratio` keys and omits `PipeUtilization.csv` ([UI-55](../../../docs/context/decisions/UI.md)). Memory CSV path (`v930/memory-load-detail`): tabs, search, block switcher, 查看全部. Overlay body fills the column under the header; the field list scrolls (no inner max-height cap). The stacked report (including its shell header) stays mounted under an opaque absolute overlay that covers the full aside, so back + title fade with the tables. Show/hide is a 200ms **opacity-only** `Transition` (`pr-aside-detail`; PR-STATS-039) — no scale. **Scope (DATA-19 / DATA-29):** under **All** the product `summary.jsonl` category list is the default and the CSV list falls back to the first `block_id` (a CSV list has no aggregate row); with a block picked the CSV field list **replaces** the category list and shows that block's row.

### Hardware details (M1 interim DATA-34a)

**更多** opens the hardware overlay (UI-30, UI-31): always visible on the report shell; emits `open-hardware-details`. When `hardwareDetails` is present, render `HardwareDetailsPanel`; otherwise show **缺少 hardware info** / Missing hardware info. Overlay chrome carries back + title (no close); enter/leave matches compute/memory (PR-STATS-039).

## Acceptance Criteria

1. **PR-STATS-001** — Renders summary stats.
2. **PR-STATS-002** — Renders PIPE bars with correct colors.
3. **PR-STATS-003** — Cube|Vector toggle appears only for MIX; filters bars by side.
3b. **PR-STATS-038** — Emulate Cube|Vector 0|Vector 1 toggle; single-core bars.
4. **PR-STATS-004** — Blank or unrecognized `opType` shows all PIPE sides (compute-shaped occupancy).
5. **PR-STATS-005** — Compute overlay search-only; memory keeps 查看全部.
6. **PR-STATS-006** — Header title and close emit.
6b. **PR-STATS-006b** — Compute / memory / hardware overlay chrome shows back and omits close; the report-shell close stays mounted under the opaque overlay and is reachable again after back. While `asideSurface !== 'report'`, the shell header and `.pr-aside__main` are `inert` so Tab / AT do not reach controls under the overlay.
6c. **PR-STATS-006c** — When `performanceHints` capability + rows exist, title-row **性能分析** sits left of close and emits `open-performance-hints`; hidden without the capability or on overlay shells.
7. **PR-STATS-007** — Meta 进程 / 算子类型 / Blocks hide-if-missing; **更多** always on compute report shell. Emulate (`report.profile === 'emulate'`) omits meta row, **更多**, summary cards, and summary CANNBot ([DATA-47](../../../../docs/context/decisions/DATA.md)).
8. **PR-STATS-008** — More always visible on compute report shell; missing hardware shows placeholder message.
9. **PR-STATS-009** — Duration card sketch chrome (raised tile, split value/unit, value-row secondary; segmented bar + legend + hover list when `durationBreakdown` present).
10. **PR-STATS-009b** — Summary cards use the sketch 2×2 grid, collapsing to one tile per row below a **430px** well (PR-STATS-036).
11. **PR-STATS-009c** — Duration display rounds to 2 decimal places; the shared card tooltip leads with the full value, then describes the metric (整体耗时 / Task Duration) (PR-STATS-040).
12. **PR-STATS-010** — No type card; secondary hide-if-missing.
13. **PR-STATS-011** — Duration present, no `computeCard` / parallel fields: compute + AICore-parallel placeholders are `N/A`; BW not from `summary.ioBandwidth`.
13b. **PR-STATS-011b** — BW-only summary omits duration-gated placeholders.
13c. **PR-STATS-011c** — `parallelUtilization` / `parallelBalance` render dual AICore columns with 2dp `%` scores and bars (DATA-9 / DATA-10); a lone field yields a single column; out-of-range fractions clamp the visible score + bar to [0, 100] while the shared card tooltip leads with the unrounded percent and then describes the metric (PR-STATS-040).
14. **PR-STATS-012** — PIPE scale, chart well, hatched bars, in-track percent.
15. **PR-STATS-013** — Absolute time is a track sibling.
16. **PR-STATS-014** — Details emit open-pipe-details.
16b. **PR-STATS-014b** — One block switcher (**All \| every `block_id` in the report**, compute ∪ memory in fixture order) when >1 block; scopes PIPE, topology, BW, compute and roofline: `All` = the `summary.jsonl` aggregate, a picked id = that block's CSV row; report change resets to `All` (DATA-19 / DATA-28 / DATA-29).
16c. **PR-STATS-014c** — 详情 follows the same selector: under **All** the `summary.jsonl` category list is the default (with search), with a block picked the CSV field list replaces it and shows that block's row (DATA-19 / DATA-29).
16d. **PR-STATS-014d** — A picked block with no data blanks its widget instead of repeating the **All** value: BW card and roofline hidden, compute card **N/A**, empty PIPE rows; the switcher stays reachable so **All** can be restored.
16e. **PR-STATS-014e** — A picked block with CSV rows rebuilds only the GM point + mix and **keeps** the All model's chip-level `series` roofs **and** non-`gm` measured points (not the example catalog). An All model with no `series` keeps its root `peakComputeTops` / `peakBandwidthGBs` instead of the example catalog.
17. **PR-STATS-015** — Roofline section when `roofline.points` present **and** the `roofline` capability is passed; hidden without the capability (even with points) and when absent.
18. **PR-STATS-016** — PIPE 详情 opens compute overlay when compute tables exist and emits open-pipe-details.
19. **PR-STATS-017** — Topology 详情 shows memory CSV overlay when tables present.
19b. **PR-STATS-017b** — Topology right-click opens the same memory CSV overlay (UI-35).
20. **PR-STATS-018** — 更多 navigates to hardware overlay when hardwareDetails present; back returns.
21. **PR-STATS-018b** — OpBasicInfo fallback still renders `HardwareDetailsPanel` (not missing copy).
22. **PR-STATS-019** — Topology section (diagram) when the current `memoryTopology` is drawable — a plated edge value or the L2 plate (see the adapter's `hasDrawableTopology` rule); hidden when absent or when the only labels sit on plated-less edges (`l0c-l1` / `l0c-l2` / `l2-l1-write`). **详情** remains per PR-STATS-023.
23. **PR-STATS-020** — No mode-tab switcher on the stacked report.
24. **PR-STATS-021** — Overlay returns to stack when report changes or overlay data disappears; the block selection resets to `All` for the new report (nothing stale carries over).
25. **PR-STATS-022** — Topology labels follow the selected block; no first-block fallback; CSV tab switch does not rewrite the bound id.
26. **PR-STATS-023** — Memory 详情 is available when memory tables exist even if the topology diagram is hidden.
27. **PR-STATS-024** — Bandwidth util 读|写 card, GB/s, score bar.
28. **PR-STATS-025** — Black aside shell; grey section islands.
29. **PR-STATS-025b** — Section titles (Roofline, PIPE, topology) and **详情** sit on the aside shell outside the `#262626` island; grey panels wrap chart bodies only (toggle + chart for PIPE; diagram for topology).
30. **PR-STATS-025c** — Summary card grid shares the stack column with grey islands (no horizontal well inset; bottom pad `8px` only).
31. **PR-STATS-026** — CANNWork three-state button groups ([CannbotActions](./CannbotActions.vue), `.pr-cannbot-actions` wrapper) render at the three section anchors; in CSV-only mode on the compute/memory list titles; compute/memory groups gated on `computeTables`/`memoryTables` (payload data), not on pipe/topology visibility. Without `cannbotSessions` every group is idle (分析 | 引用).
32. **PR-STATS-027** — The idle / settled 分析 button click emits open-cannbot with the scope (`cannbot-{scope}` testid in both states).
32b. **PR-STATS-044** — Per-scope three-state rendering from `cannbotSessions`: idle renders **分析 | 引用**; running renders the **正在分析** stop button (stop glyph + blue `cannbotAnalyzing` label 正在分析) next to the always-on 引用, and no 分析/查看; settled renders **分析 | 引用 | 查看** as three icon buttons in one pill (hairline dividers).
32c. **PR-STATS-044b** — State-driven emits: running click emits **open-cannbot-stop** with the scope; settled 引用 / 查看 clicks emit **cannbot-reference** / **cannbot-view** with the scope; settled 分析 still emits **open-cannbot**; idle 引用 emits **cannbot-reference** too.
32d. **PR-STATS-044c** — Browser / playground degradation: with no `cannbotSessions` prop every scope stays idle — 分析 | 引用 render, no 查看 button, no stop label; sibling scopes having sessions never leaks into a scope without its own key.
32e. **PR-STATS-044d** — The aside passes `cannbotSessions` through to every anchored group, so scopes render **independently** in one mount (settled summary + running compute + idle memory), and the aside re-emits each group's stop / reference / view event with the scope.
32f. **PR-STATS-045** — The **执行优化** pill (icon + localized label, `perform-optimization-trigger`) renders in the title row immediately left of close × and emits **perform-optimization** on click; it is not gated on capabilities or report content.
32g. **PR-STATS-046** — The 详情 entry is the section **title + chevron button** (`pipe-details` / `topology-details`): title text, chevron and the gap between them all trigger it. Its click carries a **1s cooldown** (R9 防抖): the first click opens the overlay and emits immediately; repeats inside the window are swallowed; the next click after the window behaves normally.
32h. **PR-STATS-047** — Emulate packs (`profile === 'emulate'`) keep the CANNWork group for every section they actually render: compute in the PIPE head (`computeTables`) and memory in the topology head or the CSV-only memory list (`memoryTables`), each showing 分析 | 引用. The summary group is still absent because emulate drives no summary chrome (DATA-47 / PR-STATS-007).
33. **PR-STATS-028** — Aside shell paints a non-interactive orange top wash (`96px`, design linear-gradient) behind the header; title/meta/body stay above it.
34. **PR-STATS-029** — Stacked body scrolls vertically only (`overflow-x: hidden; overflow-y: auto`); a vertical scrollbar gutter or DPR subpixel must not open a horizontal scrollbar.
35. **PR-STATS-031** — Duration secondary `{blockDim} Blocks / {coreCount} 核` on the value row only when breakdown absent; segmented 头开销/计算/通信 bar + four-row hover when `durationBreakdown` is set; no bar when absent.
36. **PR-STATS-032** — Compute card Cube|Vector score bar and TFLOPS subtitle.
36b. **PR-STATS-032b** — Lone Vector / write columns use secondary bar hue (COLOR_TOKENS semantic, not index).
37. **PR-STATS-033** — The section head is the **title + chevron 详情 button** (left) and the cannbot group (right, `.pr-pipe-head__actions`); there is no separate **详情** text button. The topology **全屏** control lives in the diagram's own bar ([panel spec](./MemoryTopologyPanel/MemoryTopologyPanel.spec.md) zoom/fullscreen bar), so it appears exactly when the diagram does and disappears with it; the aside opens the bar with **showFullscreen**.
38. **PR-STATS-034** — The bar's **全屏** emits open-topology-fullscreen (re-emitted from the panel's `open-fullscreen`); does not open CSV overlay.
39. **PR-STATS-035** — The memory 详情 **CSV field list** (the `CsvFieldListPanel` rendering, used when no memory summary categories exist — CSV-only reports) also offers the `PipeUtilization` tab when that table is present, so MTE utilizations stay reachable even though the export gives the chrome's MTE blocks no value plate (UI-38). Reports **with** memory summary categories list those categories instead (memory files only); their MTE ratios stay reachable under 计算 详情 → `PipeUtilization`.
40. **PR-STATS-036** — Summary tiles never crop text silently and never paint outside their tile, at any aside width (**280–720**) and in either locale:
    - the card label and the duration secondary **wrap inside the tile** (the secondary breaks a no-space `opName` instead of spilling);
    - the column label sits **beside** the score while the two fit on one line and **under** it when they do not;
    - a column narrower than the label **itself** ellipsizes it — and **every** column label (AICore, compute, BW) opens the shared card tooltip (PR-STATS-041) with its full text while it is cut (PR-STATS-041d), so an ellipsis always has a tooltip;
    - **below a 430px content well** the 2×2 grid collapses to **one tile per row**, so the side columns keep the full well width instead of ~36px.
41. **PR-STATS-037** — Emulate / `archDiagram`: a **Metric** label + `CardMetricSelect` (same chrome as swimlane card-header metric dropdowns) sits **above** the memory topology diagram; changing mode rebuilds edge labels from ArchDiagramMetrics for **that mode only** (`*_gbs` / `*_ratio` / `*_cnt`) — no fallback to the adapter’s default `*_gbs` snapshot; undrawable mode → DATA-30 hide **plates** only (Metric switcher stays; ArchDiagram-only does not flip to csv-only EAV). Hidden on compute. Mode is shared with topology 全屏 via optional `archMetricMode` v-model ([ProfilingReport](../ProfilingReport/ProfilingReport.spec.md) topology fullscreen Metric).
42. **PR-STATS-039** — Compute / memory / hardware detail overlays show and hide with a 200ms **opacity-only** `Transition` (`pr-aside-detail`) that covers the full aside so back + title fade with the tables; no scale; `prefers-reduced-motion: reduce` drops the transition; leave uses `pointer-events: none` so clicks reach the stacked report under the fading overlay.
43. **PR-STATS-040** — **Every number in the summary cards opens the shared card tooltip** (PR-STATS-041) naming the metric and what it means: duration, its secondary, AICore 并行使用率 / 负载均衡度, 算力情况 Cube / Vector score **and** `measured / peak` sub-ratio, 带宽利用率 读 / 写 score **and** sub-ratio. **All of them lead with the exact value** (`准确值` / `Exact value`) — none is description-only: duration (full unrounded amount), AICore (raw `fraction×100` percent), compute / BW scores (precise `measured ÷ peak` percent that the clamped, integer display rounds), both sub-ratios (raw `measured / peak` values) and the duration secondary (its exact line text). Every `Exact value` figure is printed through the shared `exactNumber()` rule — real precision kept, binary-float residue stripped. A **published measurement** keeps up to **12 significant digits** (the duration amount and its secondary); a **derived percent or ratio** — including both operands printed inside a `measured / peak` sub-ratio — stops at **4** (PR-STATS-042), because multiplying or dividing those measurements turns the extra digits into arithmetic noise. Three derivations need the residue rule: the BW **sum** (`aic` + `aiv`, `0.1 + 0.2` → `0.3` not `0.30000000000000004`), the compute **mean**, and the duration `/1000` into `ms` (`1000.004` µs → `1.000004`). Copy: `src/i18n` `durationValueHint` / `durationSecondaryBlocksPerCore` / `durationSecondaryBlocksOnly` / `durationSecondaryOpName` / `parallelUtilHint` / `parallelBalanceHint` / `computeScoreHint` / `computeRatioHint` / `bandwidthScoreHint` / `bandwidthRatioHint` / `exactValue`.
44. **PR-STATS-041** — Summary-card tooltips render in **one shared popover**, not native `title` attributes, with the same chrome as the timeline `EventTooltip` / overview value tip: fixed, pointer-following (**12px** offset), `var(--pr-surface-raised, #363636)` on a 12px radius, `1px rgba(255,255,255,0.05)` border, `0 0 16px rgba(0,0,0,0.2)` shadow, `8px 10px` padding, 12px text at 1.45, `180px` min / `320px` max width (the cap keeps the prose hint at the timeline tip's scale), and the same `120ms` opacity fade-in (dropped under `prefers-reduced-motion: reduce`). It is **teleported to `body`** — the house pattern for floating chrome (ContextMenu, ReportToolbar's popovers, OverviewCharts' value tip) — so it sits in the root stacking context and no panel's `overflow` or stacking context can crop it (PR-STATS-041f). Line 1 is the **exact value** in 600 weight + tabular numerals; line 2 is the metric description, **white on both, separated by weight** (PR-STATS-041e). No `title` attribute remains inside the summary grid.
44b. **PR-STATS-041b** — The popover **flips** to the pointer's other side whenever following it one way would run off the viewport, because the aside is docked against the right edge: the old one-way offset cut up to **149px off a 180px box** on the AICore 负载均衡度 / BW 写 columns. It anchors the flipped case with `right` / `bottom` (no measurement) and flips vertically about the viewport's halfway line, so the box always grows into the half with room.
44c. **PR-STATS-041c** — The popover is a `role="tooltip"` with a stable id; every **value** trigger (duration, its secondary, the AICore / compute / BW scores and both `measured / peak` sub-ratios) carries `tabindex="0"`, opens on `focus` and closes on `blur`, and paints a `:focus-visible` ring — the exact values were reachable only by pointer once `title` was dropped. Only the **trigger that owns the open popover** carries `aria-describedby`, and only while that popover is mounted — never before or after: the popover is `v-if`-gated, so a standing reference is a dangling IDREF (a reference AT must ignore and axe fails `aria-valid-attr-value`), and because the popover is a **singleton**, binding the attribute on every focusable trigger would describe the other triggers with whichever value happens to be showing (AT browsing without focus reads the wrong metric). The popover also closes on `pointercancel` (a touch scroll that never fires `pointerleave`), on `.pr-aside__body` scroll, and when `asideSurface` changes.
44d. **PR-STATS-041d** — A **column-label** tooltip is bound only while the label is actually cut; a label that fits echoes nothing. It is not focusable and carries no `aria-describedby`, since the full label text is in the DOM regardless of the ellipsis.
44e. **PR-STATS-041e** — Both tooltip lines are **white**: the exact value leads on 600 weight + tabular numerals, the description follows at normal weight. The description is a full sentence at 12px and does **not** take the timeline tip's muted `#969696` (PR-STATS-041).
44f. **PR-STATS-041f** — The popover is **teleported to `body`**, not rendered inside `.pr-aside`. Living in the aside could not paint above the timeline: `.pr-main` is `z-index: 1` while `.pr-layout__aside` is `z-index: 0`, so the whole panel outranks the whole aside subtree and a left-flipped tip lost **177px of a 320px** box at the seam. It keeps its scoped styles and the `--pr-surface-raised` token (declared on `:root` as well as `.pr-root`), stays `position: fixed` in the root stacking context at the raised-chrome level (**20**), and stays `pointer-events: none` so the trigger keeps receiving the moves that drive it.
44g. **PR-STATS-041g** — The popover is dropped on a **window resize**, like `.pr-aside__body` scroll and `asideSurface`: its flip reads `window.innerWidth` / `innerHeight` in a computed, those getters are not reactive, and nothing else re-runs the placement. Left alone it keeps the coordinates of the pre-resize layout — measured from a keyboard-focused trigger, a 1600 → 1100px resize stranded the box **708px** from the card it describes and off-screen right. The `resize` listener is the component's, added on mount and removed on unmount.
45. **PR-STATS-042** — An `Exact value:` line for a **derived** percent or ratio prints **4 significant digits**, not the 12 `exactNumber` keeps by default (`RATIO_PRECISION_DIGITS`). The 12-digit ceiling is for a published measurement — a raw throughput, a wall-clock amount — where the digits are real; a percent or a ratio multiplies or divides those, so the extra digits are arithmetic noise. Only digits that carry information are printed: leading zeros are never significant and `Number()` drops the trailing ones, so `41.1011153199%` reads `41.1%`, `39.4570707071%` reads `39.46%` and `60.8256` reads `60.83`. A value that is already short (`68.25%`, `1600 GB/s`, `50%`) passes through **unchanged** — the ceiling never adds precision or padding. It applies to the compute / BW **scores** and both `measured / peak` **sub-ratios** and to the AICore 并行使用率 / 负载均衡度 percent; the **duration** amount and its secondary are measurements rather than derived ratios, so they keep the 12-digit rule (and with it `1.000004 ms`, which is the residue case that rule exists for).
46. **PR-STATS-043** — §11.2.3.2 heat units: the stacked diagram gets **`selectableUnits`** only when the report carries the heat surface — the **`memoryHeatmap`** capability **and** at least one unit in `report.memoryHeatmap.units` ([MemoryTopologyPanel](../StatsAside/MemoryTopologyPanel/MemoryTopologyPanel.spec.md) heat-unit selection). A host that passes `capabilities` without `memoryHeatmap` gets **no** clickable units, even with a filled carrier — otherwise the click would open a 全屏 overlay whose heat column the parent never mounts ([ProfilingReport](../ProfilingReport/ProfilingReport.spec.md) heat column). A standalone mount with no `capabilities` prop falls back to the carrier alone. A unit click re-emits **open-topology-fullscreen** with that unit as its second argument, and the aside keeps **no** selection state of its own.

## Edge Cases

| State | Behavior |
|---|---|
| report is null or undefined | Empty panel, no error; title + close still shown |
| Empty pipeOccupancy | No bars; summary still visible if present |
| Non-MIX known opType | No Cube|Vector toggle; side-filtered bars |
| Blank/unrecognized opType (cube/vector sides) | Show all PIPE bars |
| Emulate ≥2 of aic/aiv0/aiv1 | Cube\|Vector 0\|Vector 1 toggle; filter by active core |
| Emulate single aic/aiv0/aiv1 (+ opType AIC/AIV) | No toggle; show that core's bars (not blank via knownSide) |
| Missing compute / AICore-parallel fields | With duration: compute **N/A** when `computeCard` absent; AICore **N/A** when both parallel fields absent; BW-only: placeholders omitted |
| AICore one field only | Single 并行使用率 or 负载均衡度 column |
| `computeCard` with one side | Single Cube or Vector column; no **N/A** chrome |
| `summary.ioBandwidth` only | No BW cards (need `bandwidthCards`) |
| Bandwidth side all NA | That column omitted; card omitted if both sides NA |
| Duration without blockDim or opName | Duration card; no secondary line |
| `coreCount` absent | Duration bar decorative ~15%; secondary uses blockDim only |
| `blockDim` = 0 with `coreCount` | Duration bar width 0% (no 2px sliver) |
| No pid / opType / blockDim | Meta segments hidden; meta row still shows **更多** + cannbot |
| Aside at its **280px** minimum (well < 430px) | Summary grid is one tile per row; card, secondary and column labels all fit outright |
| Card / column label wider than its box | Wraps at spaces (secondary also mid-token); a label wider than its column on one word ellipsizes with the full text in the shared card tooltip (PR-STATS-041) |
| Freq-only summary (`currentFreq` / `ratedFreq`) | No meta segments; meta row still shows **更多** + cannbot |
| No `hardwareDetails` on model | **更多** opens overlay with **缺少 hardware info** |
| OpBasicInfo fallback only (`hardwareDetails` present, no jsonl) | **更多** opens `HardwareDetailsPanel` with fallback sections |
| Absolute time all NA | Bar shows ratio/% only; no in-bar absolute |
| No `roofline` capability / no roofline model / empty points | Roofline section omitted |
| No memoryTopology | Topology section omitted |
| Selected block not drawable (no label, or plated-less labels only) | Topology diagram hidden, so its bar (zoom + 全屏) is hidden too; 详情 remains if memory tables exist |
| Topology diagram shown | Header actions are cannbot → 详情; zoom/**全屏** controls live in the diagram's own bar |
| Overlay open, report replaced | Return to stacked report; block selection resets to `All` |
| CSV tables only | Compute/memory lists on the stack |
| No `cannbotSessions` prop / empty object | Every scope idle: 分析 \| 引用 (browser / playground / exported HTML degradation) |
| Mixed session states in one mount | Scopes render independently — settled 分析\|引用\|查看, running 正在分析\|引用, idle 分析\|引用 side by side |
| Session status `unknown` | Counts as settled (引用 / 查看 render); only `running` is live |
| Emulate pack (`profile: 'emulate'`) | compute / memory groups render with the sections they own; no summary group — emulate has no summary chrome (DATA-47) |
| 详情 double click (within 1s) | One overlay open, one emit; the cooldown re-arms after the window |

## Visual

Crops (shell): [`visual/aside-scrolled.png`](./visual/aside-scrolled.png) — [`visual/provenance.yaml`](./visual/provenance.yaml). Child packs: [`PipeOccupancyPanel`](./PipeOccupancyPanel/visual/), [`StatsSummaryPanel`](./StatsSummaryPanel/visual/), [`HardwareDetailsPanel`](./HardwareDetailsPanel/visual/).

Sampled from `v930/report-stats-open` / `v930/report-stats-scrolled` (aside column). Toolbar-style token tables.

### Shell

| Token | Value |
|-------|--------|
| Background | `#1a1a1a` (`--pr-bg-aside`) — shell / gutter between islands (`v930/detail-strip-raised`) |
| Islands | `#262626` (`--pr-bg-panel`) — Roofline chart card, PIPE chart body, topology diagram; summary cards keep the raised gradient on the same well |
| Section titles | On the aside shell **outside** grey islands — **计算负载分析**, **内存负载分析**, Roofline title (see child specs); **详情** aligns with the title row |
| Padding | `10px 12px` (content well **456px** at default **480px** aside; reflows when the aside is resized) |
| Title | `16px` / `600` / `#ffffff` / line-height `22px` |
| Chart icon | `16×16` L-axis + sparkline stroke, `#e6e6e6` |
| Close / back | stroke SVG `14×14`, `#e6e6e6` (rounded caps; not `×` / `←` glyphs) |
| Meta | `12px` / line-height `16px`; label `#8a8a8a`, value `#d0d0d0`; item gap `12px`; title→meta `12px` |
| 更多 | `12px` / `#8a8a8a` (not playhead blue) |
| PIPE / topology 详情 | `12px` / `#e6e6e6` |
| Topology bar | Owned by [`MemoryTopologyPanel`](./MemoryTopologyPanel/MemoryTopologyPanel.spec.md) (PR-MEMTOP-014/015): `#313131` strip, `#b3b3b3` controls, accent **适应窗口** |
| Header | pinned (`flex-shrink: 0`); body / overlay `flex: 1; min-height: 0`; body `overflow-x: hidden; overflow-y: auto` (no horizontal scrollbar) |
| Top wash | Absolute `96px` band at the top of `.pr-aside`: `linear-gradient(181.55deg, rgba(244, 132, 12, 0.1) -20.986%, rgba(199, 98, 7, 0) 81.41%)`; `pointer-events: none`; paints under title/meta (`PR-STATS-028`) |

### Summary card grid (`summary-cards.png`, also `v930/detail-strip-raised` aside)

| Token | Value |
|-------|--------|
| Well | `#1a1a1a` (`--pr-bg-aside`); **bottom** padding `8px` only (band before next stack section); tile left/right edges align with grey islands below |
| Columns | Sketch **2×2** equal tiles (duration \| AICore parallel; compute \| bandwidth); one tile per row below a **430px** well (PR-STATS-036) |

### Duration card ([`duration-card.png`](./StatsSummaryPanel/visual/duration-card.png) / `detail-strip-raised` cell)

| Token | Value |
|-------|--------|
| Surface | `linear-gradient(225deg, #272f31 0%, #262b2c 35%, #252525 72%)` (detail-strip-raised TR→BL samples) + inset `1px` highlight `rgba(255,255,255,0.04)`; radius `8px`; pad `12px 14px` |
| Label | `11px` / `#999999`; margin-bottom `6px`; wraps when the tile is narrower than the label (PR-STATS-036) |
| Value | number `20px` / `600` / `#ececec`; unit sibling `12px` / `500` / `#868686`; shared tooltip (PR-STATS-041) = exact (`准确值` / `Exact value`) amount first, residue-stripped, then the metric description (PR-STATS-040) |
| Value-row meta | `11px` / `#8a8a8a`, right of value (`Blocks / 核`); wraps / breaks mid-token (PR-STATS-036) |
| Bar | only when `durationBreakdown` set; height `8px`; pill; flex segments `--pr-color-duration-overhead` `#0CB8A4` / `--pr-color-duration-compute` `#1476FF` / `--pr-color-duration-comm` `#8E81F4` |
| Legend | `11px` / `#8a8a8a`; space-between under bar when segmented |
| Breakdown hover | `--pr-surface-raised` / `1px` `--pr-divider` / radius `6px` / `12px` — see [`duration-card-tooltip.png`](./StatsSummaryPanel/visual/duration-card-tooltip.png) |

### 算力情况 card (`summary-cards.png`)

Same raised card chrome as duration.

| Token | Value |
|-------|--------|
| Inner | **Cube** \| **Vector** columns (`display: flex; gap: 8px`; equal flex children) |
| Score | same Value number token; **no** `%`; shared tooltip leads with the precise percent (`准确值`) then *{side} utilization — measured throughput ÷ theoretical peak* (PR-STATS-040) |
| Side label | `11px` / `#999999`; beside the score on the same row while both fit (`flex`, `8px` gap — the sketch gap before `Cube` / `Vector`), else its own line under the score; ellipsis + shared tooltip when it is wider than the column on one word (PR-STATS-036) |
| Bar | same 8px pill hatched track; fill = score %; sketch uses distinct hues per side; 0% fill `min-width: 0` |
| Sub | `measured / peak` then `TFLOPS` on the next line (magnitude rounding); shared tooltip leads with the raw values (float residue stripped, 4 significant digits; PR-STATS-042) then describes the ratio (PR-STATS-040) |

### 带宽利用率 card (`summary-cards.png`)

Sketch: one card, **读 \| 写** columns (not separate 输入/输出 cards).

| Token | Value |
|-------|--------|
| Inner | **读** \| **写** columns (equal flex) |
| Score | same Value number token **with** muted `%`; shared tooltip leads with the precise percent (`准确值`) then *{dir} bandwidth util — measured ÷ theoretical peak* (PR-STATS-040) |
| Side label | `11px` / `#999999`; beside the score on the same row while both fit (`flex`, `8px` gap), else its own line under the score; ellipsis + shared tooltip when it is wider than the column on one word (`读` / `写`; PR-STATS-036) |
| Bar | same 8px pill hatched track; fill = score %; 0% fill `min-width: 0` |
| Sub | `measured / peak` then unit on the next line (**GB/s**, UI-34; sketch TB/s); shared tooltip leads with the raw values (float residue stripped, 4 significant digits; PR-STATS-042) then describes the ratio (PR-STATS-040) |

### AICore 并行使用率 (DATA-9 / DATA-10)

Mount only when duration is present. Omit when the summary is BW-only.

| Token | Value |
|-------|--------|
| Chrome | same raised tile |
| Columns | **并行使用率** \| **负载均衡度** (same `pr-bw-cols` chrome as BW) |
| Side label | `11px` / `#999999`; beside the `%` score while both fit, else under it; ellipsis + shared tooltip when wider than the column on one word (PR-STATS-036) |
| Score | large number **with** `%`; bar fill = min(100, score)%; util primary / balance secondary hue; shared tooltip leads with the exact unrounded percent then the metric description (PR-STATS-040) |
| Body when empty | label + `N/A` value (`#8a8a8a`); no bar |

### PIPE (`pipe-bars.png`, `mode-tabs.png`)

Sampled from [`v930/compute-load`](../../../docs/ui/source/v930/compute-load.jpeg) at ~4× (bar 64px crop → 16px CSS).

| Token | Value |
|-------|--------|
| Section head | Title + **详情** on `--pr-bg-aside` (outside island); `gap` `8px` to the island below |
| Panel | `#262626` (`--pr-bg-panel`), radius `4px`, padding `12px 10px 10px` |
| Title | `14px` / `600` / `#ffffff` — **计算负载分析** (on aside shell, not inside panel) |
| 详情 | `12px` / `#e6e6e6` |
| Block select | Rendered when `PipeUtilization.csv` holds >1 `block_id` (PR-STATS-014b). Localized caption via `t('block')` — **分块** (zh-CN) / **Block** (en); `#b8b8b8`, gap `6px` — + `CardMetricSelect` (same chrome as swimlane card-header / ArchDiagram Metric dropdowns, `variant="inline"`). Open menu width is at least the trigger and grows to the longest option (`width: max-content`) so labels are not clipped to a short selection. Memory overlay CSV block switcher still uses `.pr-block-pill` ([`CsvFieldListPanel`](./CsvFieldListPanel/CsvFieldListPanel.spec.md)). |
| Cube\|Vector | pill `#111111`; active `#343434` / `#ffffff`; inactive `#b3b3b3`; radius `4px`; label `12px` |
| Chart well | `#202020`, radius `4px`, padding `10px 8px 12px` |
| Scale | `12px` / `#999999` |
| Label | `12px` / `#999999`; column `72px` (ellipsis; fits `ICache Miss`) |
| Bar height | `16px`; radius `4px`; row gap `16px` |
| Grid | `rgba(255,255,255,0.15)` 1px overlay at 20/40/60/80% (reads dotted on hatch) |
| Hatch | `color-mix(8%, #202020 / #303030)` of `colorKey`; diagonal 2px/2px. Baseline 2023 (`color-mix`); older engines drop the hatch. Duration/bandwidth cards keep the untinted `#2a2a2a` / `#1f1f1f` pair from `summary-cards.png`. |
| In-bar abs | `12px` / `#ffffff`; left of track (sibling of fill, so short fills are not padded wider than the ratio) |
| Percent | `12px` / `#ffffff` inside track, right-aligned |
| Fills | COLOR_TOKENS `colorKey`; width = ratio%; `min-width: 0` |
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

[COLOR_TOKENS.md](../../../docs/ui/COLOR_TOKENS.md), [view-models](../../../specs/core/view-models.spec.md), [INTERACTIONS.md](../../../docs/ui/INTERACTIONS.md), DATA-8, DATA-19, DATA-28, DATA-29, DATA-33a, DATA-33d, DATA-33e, DATA-33f, DATA-33h, DATA-34a, DATA-37a–f.

## Changelog

- **2026-11-09** — Review follow-up: **引用常驻** in every state (idle 分析\|引用, running 正在分析\|引用, settled 分析\|引用\|查看) — restates PR-STATS-026/044/044b/044c to match the shipped code; the running label is **正在分析** (`cannbotAnalyzing`). Adds PR-STATS-047: emulate packs keep the compute / memory groups and still omit the summary group (DATA-47).
- **2026-10-30** — CANNWork 优化 (design doc R1–R9): the cannbot entry becomes a **per-scope three-state button group** ([CannbotActions](./CannbotActions.vue)) driven by the new **cannbotSessions** prop — idle single 分析 (multi-colour `cannwork-analyse`), running 停止 glyph + blue 正在分析 label emitting **open-cannbot-stop**, settled 分析\|引用\|查看 emitting **cannbot-reference** / **cannbot-view** (PR-STATS-044/044b/044c/044d). States are scope-independent; no prop = all idle (browser degradation). The **详情** text button is replaced by the **section title + chevron button** with a 1s click cooldown (R9 防抖, PR-STATS-046); the title-row **执行优化** pill emits **perform-optimization** (PR-STATS-045). PR-STATS-026/027/033 restated for the new DOM.
- **2026-10-01** — §11.2.3.2 heat units on the stacked diagram (PR-STATS-043): `selectableUnits` now needs the `memoryHeatmap` capability as well as a filled `memoryHeatmap` carrier, matching the overlay's own gate; a unit click re-emits `open-topology-fullscreen` with the clicked unit so 全屏 opens on it.
- **2026-10-01** — A derived percent or ratio stops at **4 significant digits** (PR-STATS-042), from review: the compute scores printed as `41.1011153199%` / `39.4570707071%` and the ratio as `25 / 60.8256 TFLOPS`. `exactNumber`'s 12-digit default is right for a *published* measurement (a wall-clock amount, a raw throughput) but not for a value derived by multiplying or dividing one — those digits are arithmetic noise, not precision. Leading zeros never count as significant and trailing ones are dropped, so `41.1011153199%` reads `41.1%`; a percent that was already short (`68.25%`) is untouched. Scoped to the compute / BW scores, both `measured / peak` sub-ratios and the AICore percent: the duration amount and its secondary are measurements, and they keep the 12-digit rule that `1.000004 ms` depends on.
- **2026-09-30** — The tooltip contract loses its dangling reference and its stale placement (PR-STATS-041c / PR-STATS-041g). `aria-describedby` was bound unconditionally, but the popover is `v-if`-gated, so every value trigger advertised an id that was absent from the document whenever no tooltip was open — measured, all **8** of them, which is exactly the broken reference axe's `aria-valid-attr-value` reports (AT ignores it, so the attribute bought nothing). It is now bound only while the popover is mounted, which lands in the same flush. Separately, a keyboard-focused popover **survived a window resize**: the flip caches `window.innerWidth` in a computed, the getter is not reactive, so the box kept its pre-resize coordinates — measured, a 1600 → 1100px resize left it **708px** from its card and off-screen. A `resize` listener now drops it, like the existing scroll / surface-change contract.
- **2026-09-30** — The shared popover is **teleported to `body`** and both its lines go **white** (PR-STATS-041e / PR-STATS-041f). The flip added below put the box on the pointer's left wherever it would otherwise leave the viewport, but the aside slot could not paint it there: `.pr-main` is `z-index: 1` and `.pr-layout__aside` `z-index: 0`, so the entire timeline panel outranks the entire aside subtree — measured, compute Vector's tooltip lost **177px of a 320px** box, cut off exactly at the panel seam. `Teleport` follows the house pattern for floating chrome (ContextMenu, ReportToolbar popovers, OverviewCharts' value tip) and lifts the popover into the root stacking context, where no ancestor `overflow` or stacking context can crop it. The description also stops inheriting the timeline tip's muted `#969696`: at 12px it is a full sentence, so it reads white with the value, and weight carries the hierarchy.
- **2026-09-30** — Review follow-up (PR-STATS-041b..041d): the shared popover **flips** instead of running off the right edge (measured: the right hand AICore / BW columns lost up to 149px of a 180px box, the aside being right-docked), gains a real keyboard path — `role="tooltip"` + `aria-describedby` + `tabindex="0"` + `:focus-visible`, restoring what native `title` quietly did for assistive tech — and closes on `pointercancel` / body scroll / surface change, which used to strand it. Column-label tooltips now stay quiet while their label fits rather than echoing it, and their text is built once per view model. Compute / BW scores document the clamp their tooltip deliberately exceeds.
- **2026-09-30** — Review follow-up (PR-STATS-040 / PR-STATS-041): summary-card tooltips drop the native `title` attribute for **one shared popover** painted in the timeline `EventTooltip` chrome, and the exact value moves to the **first** line (the description follows). Every number — compute / BW scores, the duration secondary and the column labels included — now carries that exact-value line, so none is description-only.
- **2026-09-29** — Review follow-up (PR-STATS-040): the duration amount joins the shared `exactNumber()` rule — a `/1000` into `ms` is not residue-free (`1000.004` µs → `1.0000040000000001`), so "every exact figure" is now literally true rather than an overstatement; the spec test helper takes the mount `locale` so an `en` assertion cannot silently match zh-CN copy.
- **2026-09-29** — Every number in the summary cards gains a descriptive hover `title` naming the metric and what it means — including the duration secondary and the `measured / peak` sub-ratios, which previously had no tooltip or only the bare value (PR-STATS-040). Duration, AICore and both sub-ratios keep the exact value on a second line; compute / BW scores and the duration secondary are already exact, so they carry the description only. Every `Exact value` figure strips binary-float residue at 12 significant digits (BW sides are summed, compute sides are means).
- **2026-09-25** — Performance-hints entry moves to the report-shell title row as a **性能分析** link left of close × (PR-STATS-006c); body-stack 详情 section removed. Sketch + crop: [`aside-hints-title-row.png`](./visual/aside-hints-title-row.png) from `v930-sim/performance-hints`.
- **2026-09-25** — Shell header + `.pr-aside__main` are `inert` while a detail overlay is open (PR-STATS-006b).
- **2026-09-24** — Detail overlays fade opacity-only (no scale) and cover the full aside so back + title animate with the tables (PR-STATS-039).
- **2026-09-24** — Overlay headers omit close (PR-STATS-006b); back remains the only way out of compute / memory / hardware drill-in.
- **2026-09-24** — Block caption localizes (`分块` / `Block`); `CardMetricSelect` menu sizes to the longest option so a short selection does not clip longer labels.
- **2026-09-23** — Inputs: capabilities also include `archDiagram` (PR-STATS-037); PIPE **Block** select uses `CardMetricSelect` (card-header / ArchDiagram Metric chrome) with caption **Block**; memory overlay keeps `.pr-block-pill`.
- **2026-09-23** — All-scope `SummaryCategoryList` gains search filter + match chips (PR-SUMM-002), matching CsvFieldListPanel / UI-43 so 详情 is never search-less under **All**.
- **2026-09-15** — Summary tiles stop cropping text when the aside is resized (PR-STATS-036): card label and duration secondary wrap inside the tile (the secondary breaks a no-space `opName`), the column label drops under the score when the two no longer fit on one line, an ellipsis always carries the full text in `title`, and the 2×2 grid collapses to one tile per row below a **430px** well. The grid previously ran `nowrap` inside an `overflow: hidden` column, so a label wider than its column — 并行使用率 / 负载均衡度, or `Parallel utilization` in `en` — was cropped with no cue; at the **280** minimum each side column was left ~36px. The 2×2 sketch chrome is unchanged at the default **480**.
- **2026-09-15** — Every column label (AICore, compute, BW) carries its full text in `title`, not just the AICore pair, so the PR-STATS-036 ellipsis floor holds for all three cards rather than one (PR-STATS-036).
- **2026-09-15** — Topology tables now include `PipeUtilization.csv` (from `computeTables`) next to the Memory* CSVs, so the UI-49 in-box **Scalar / Vec / Cube** badges have a source in the picked-block scope as well as under **All**; the builder looks files up by name, so no other table is affected (PR-STATS-019).
- **2026-09-14** — Roofline card is out of the current release: it mounts only with the opt-in `roofline` capability, so points alone no longer render it (PR-STATS-015). No roofline code was removed.
- **2026-09-14** — Block switcher options are every `block_id` in the report (compute ∪ memory, fixture order) instead of `PipeUtilization`-only: the aside switcher and the memory overlay switcher share one state, so a memory-only id picked in the overlay can no longer leave the main `<select>` blank (PR-STATS-014b). The `All` topology model is read straight from `report.memoryTopology` instead of re-deriving the adapter's `summary.jsonl` rule (one definition, no drift).
- **2026-09-14** — Topology gate wording synced with the code: `showTopology` now asks whether the model is *drawable* (a plated edge value or the L2 plate, PR-VM-018), not merely whether a label exists. The default block pick uses the same predicate, so the snapshot no longer selects a block whose labels are all plated-less and then hides the diagram (PR-STATS-019 / PR-STATS-021).
- **2026-09-11** — **详情** lists follow the block selector: with a picked id the CSV field list replaces the `summary.jsonl` category list and shows that block's row; a picked block with no data blanks its widget (BW card / roofline hidden, compute **N/A**, PIPE rows empty) instead of repeating the **All** aggregate (PR-STATS-014c / 014d, DATA-19 / DATA-29).
- **2026-10-21** — 整体耗时: hover list is 计算/通信/通算重叠/头开销 times only (no 迭代/核); no value-row secondary while segmented bar shown (UI-32 / 2026-10-21 Product mock).
- **2026-10-19** — 整体耗时: value-row secondary; segmented 头开销/计算/通信 bar + hover list when `durationBreakdown` present (UI-32 update, PR-STATS-009/031).
- **2026-09-11** — BW 读\|写 = **sum** of the aic + aiv sides (`aicore_gm_read_bw` / `aicore_gm_write_bw`), peak = SOL 1600 shared by both sides (DATA-8); one block selector scopes every widget (`All` = `summary.jsonl`, picked id = block CSV) (DATA-19 / DATA-28 / DATA-29).
- **2026-09-10** — Summary PIPE **block** select shares the `.pr-block-pill` chrome (`tokens.css`) with the memory overlay switcher — one definition instead of two copies, so they cannot drift. The v930 frames contain no summary block control — it is a DATA-33b addition with no design source.
- **2026-09-08** — AICore dual **并行使用率** \| **负载均衡度** columns with `%` bars (DATA-9 / DATA-10, PR-STATS-011c).
- **2026-09-08** — AICore score/bar clamp to [0, 100]; unrounded percent in value `title`; 2dp display precision documented.
- **2026-09-15** — 内存负载分析 **全屏** moved out of the header into the diagram's own zoom/fullscreen bar (PR-MEMTOP-014): header actions are cannbot → **详情**; the aside passes **showFullscreen** and re-emits the panel's `open-fullscreen` (PR-STATS-033/034).
- **2026-09-08** — Topology **全屏** is a fit-window icon emitting `open-topology-fullscreen` for the root overlay (PR-STATS-033/034); hidden when the diagram is hidden.
- **2026-09-04** — UI matches v930 summary-cards **2×2**: AICore parallel placeholder; compute Cube\|Vector; single **带宽利用率** 读\|写 (mean of aic\|aiv per direction); primary/secondary bar hues.
- **2026-09-04** — v930 summary-cards refresh: sketch **2×2** (duration \| AICore 并行使用率; 算力情况 Cube\|Vector \| 带宽利用率 读\|写). Remap former 平均核利用率 / dual I/O cards.
- **2026-09-02** — Aside body is vertical-only scroll (`PR-STATS-029`); no horizontal scrollbar from exact-fit chart / scrollbar gutter.
- **2026-09-03** — Aside resize restored (default **480**, clamp **280–720**); content well reflows with column width.
- **2026-09-02** — Aside column **480px** (Product); content well **456px**.
- **2026-09-02** — Orange top wash on the aside shell (`96px` design gradient; PR-STATS-028).
- **2026-08-31** — Summary grid drops horizontal well inset so card edges align with stack islands (PR-STATS-025c).
- **2026-08-31** — Section titles + **详情** on aside shell outside grey islands (PR-STATS-025b); PIPE/topo panels wrap chart bodies only.
- **2026-08-28** — Card bar tracks use `--pr-bg-aside` so light theme matches the shell.
- **2026-08-28** — Aside shell `#1a1a1a` (`--pr-bg-aside`); islands `#262626` (`--pr-bg-panel`) from `v930/detail-strip-raised` (PR-STATS-025).
- **2026-08-27** — Gate compute/util N/A placeholders on duration (PR-STATS-011b) so BW-only summaries stay rectangular.
- **2026-08-27** — Review fixes: truncation `title` on duration secondary + BW subtitles; N/A cards flex-center the value in the stretched top-row tile; docs aligned on N/A placeholders (not hide).
- **2026-08-27** — Duration display always 2 dp; full value in `title` tooltip (PR-STATS-009c). Gradient stops re-sampled from detail-strip-raised (`#272f31` → `#252525`).
- **2026-08-27** — Restore card gradient + well `padding: 8px` (bottom band); prior flat/`padding:0` pass broke sketch chrome.
- **2026-08-27** — 算力情况 / 平均核利用率 shown as title + `N/A` placeholders when duration is present (PR-STATS-011); still ignore summary compute/util fields until DATA-33.
- **2026-08-26** — Summary cards use sketch 3+2 grid and raised tile chrome (dark well, pill 8px bars, split duration unit); drop full-width stack interim.
- **2026-08-31** — CSV-only fallback renders cannbot icons on the compute/memory list titles; compute/memory icons gated on `computeTables`/`memoryTables` so the entry tracks the payload data (PR-STATS-026).
- **2026-08-26** — cannbot icon entries on meta row / compute / memory section heads (PR-STATS-026/027).
- **2026-08-25** — Shell meta is 进程 / 算子类型 / Blocks (PR-STATS-007); drop 核数 / aic频率 / NPU ARCH.
- **2026-08-24** — Compute overlay omits block + 查看全部 (PR-STATS-005, `v930/search-highlight`).
- **2026-08-20** — npu-compute 0818: measured BW / HardwareInfo source / ICache / NA-hide confirmed; peak/score still open.
- **2026-08-20** — PR-STATS-013 asserts abs is a track sibling (unit tests do not apply `min-width`). PIPE hatch tint vs card hatch is deliberate.
- **2026-08-19** — PIPE fill width is ratio-only (`min-width: 0`; abs is a track sibling). Label column stays `72px` for ICache Miss. Panel stays `#1f1f1f` (artboard `#141414` is page, not card).
- **2026-08-19** — Resampled `compute-load.jpeg`: title `14px`, scale/in-bar `12px`, Scalar `#1A743E`.
- **2026-08-19** — PIPE card tokens from `pipe-bars.png` / `mode-tabs.png`: tinted hatch, in-track %, `#202020` well, 16px row gap.
- **2026-08-19** — DATA-33g peak is sketch 1600 GB/s; `--pr-color-bandwidth-bar`; flex aic\|aiv columns; 0% bar `min-width: 0`.
- **2026-08-19** — PR-STATS-024 asserts score via `data-testid`; peak is adapter max (DATA-33g).
- **2026-08-19** — I/O bandwidth cards DATA-33g (PR-STATS-024); PR-STATS-011 still hides compute/util.
- **2026-08-14** — CSV tab switch does not rewrite topology block (PR-STATS-022).
- **2026-09-18** — DATA-47: emulate omits summary cards + meta/更多 (PR-STATS-007).
- **2026-08-13** — Memory 详情 without diagram (PR-STATS-023); re-pick labelled block on report swap (PR-STATS-021).
- **2026-08-13** — Stacked 报告统计; 详情/更多 overlays; drop mode tabs; topology section (PR-STATS-019–022).
- **2026-08-10** — Hardware overlay via 更多 (PR-STATS-018, DATA-34a); PIPE 详情 → compute mode (PR-STATS-016).
- **2026-08-10** — Roofline section when points present (PR-STATS-015, DATA-37*).
- **2026-08-07** — PIPE sketch chrome: scale, hatch, absolute time, Details (PR-STATS-012–014, DATA-33f).
- **2026-08-07** — Duration card chrome DATA-33e (PR-STATS-009–011).
- **2026-08-07** — Shell close/meta/更多 (PR-STATS-006–008).
- **2026-08-07** — Mode switcher + compute/memory CSV panels (PR-STATS-005).
- **2026-08-07** — Unrecognized opType shows all PIPE sides; PR-STATS-004.
- **2026-08-07** — Cube|Vector toggle on existing PIPE panel only.
- **2026-08-05** — Initial spec.

## Open

Measure range does not recompute this aside. Roofline Product-final formulas remain DATA-37. Bandwidth cards **sum** the aic + aiv `Memory` sides (`aicore_gm_read_bw` / `aicore_gm_write_bw`) with peak SOL 1600 — **not** `Report.csv` (DATA-8 resolved). Block scope is **one** selector for every widget ([DATA-19](../../../docs/context/decisions/DATA.md) / [DATA-28](../../../docs/context/decisions/DATA.md) / [DATA-29](../../../docs/context/decisions/DATA.md)).
