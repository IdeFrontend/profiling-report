# Interim Engineering Decisions (MVP Unblock)

**These are not Product-final decisions.** They exist so MVP implementation and tests can proceed while producer / data specs are incomplete.

| Rule | Detail |
|------|--------|
| Status label | `interim` — never write as `resolved` product truth |
| Supersede | When Product or the format/data spec answers the linked question: write the decision into owning specs, **remove** the row from [OPEN_QUESTIONS](OPEN_QUESTIONS.md) and file a [DECISIONS](DECISIONS.md) entry, delete or strike this interim row, and scrub “until Q*” wording — all in the **same change**. See [DEVELOPMENT.md § Resolving open questions](../process/DEVELOPMENT.md#resolving-open-questions). |
| Tests | Assert interim behavior; titles may note `(interim)` |
    10|| Code comments | Prefer linking this file / the question id over inventing silent TBDs |

Canonical Product answers live in the owning **specs** after resolution (see [DEVELOPMENT.md § Resolving open questions](../process/DEVELOPMENT.md#resolving-open-questions)). The open list holds unanswered items only: [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md); Product-final decisions: [DECISIONS.md](DECISIONS.md). Packaging proposals that Product has not confirmed: [PACKAGING_SUGGESTIONS.md](PACKAGING_SUGGESTIONS.md) (also interim until accepted).

---

## Interim table (MVP)

| ID | Topic | Interim decision | Implement / test as | Superseded when |
|----|-------|------------------|---------------------|-----------------|
    20|| **PROC-2a** | `.ncrep` vs `.rep` | **Same binary layout and magic**; treat as product aliases for one parser | One `RepAdapter`; both extensions open Timeline | Product defines divergence (version field, required embeds) |
| **DATA-31a** | Golden fixture | Primary CI fixture = [`data/out.rep`](../../data/out.rep) (flat AIV). Acceptance = parse + render + hide rules — **not** sketch pixel-parity. Playground stress `small`/`medium`/`large` emit nested Card → Core → pipe `SwimlaneModel` for sketch hierarchy | e2e `PR-E2E-001` on `out.rep`; stress unit tests for Card tree | Sketch-faithful production golden arrives (Product DATA-31 target) |
| **DATA-33a** | Summary tiles | Show **confirmed** duration from `OpBasicInfo.csv` `Task Duration(us)`. When duration is present, compute TFLOPS and avg core util tiles stay in the sketch grid as **title + `N/A`** (do not bind guessed values); omit those placeholders when the summary is BW-only so the grid stays rectangular. Duration uses sketch card chrome (bar still DATA-33e). Op type is **not** a separate card. I/O BW → **DATA-33g** | Thin duration card + N/A placeholders in `StatsAside` | Data/format spec defines compute / avg-util formulas (DATA-33) |
| **DATA-33b** | PIPE aggregation | **Mean of non-`NA` ratios** per pipe family across `block_id` | `PipeOccupancyPanel` unit tests | DATA-33 / data spec overrides aggregation |
| **DATA-33c** | Block scope vs aggregate | Summary **PIPE bars** stay DATA-33b (mean across blocks). **Detail / memory / metrics** views are **block-scoped** via the block switcher ([`v930/memory-load-detail`](../ui/source/v930/memory-load-detail.jpeg)). Default selected block = first `block_id` in fixture order | Aside detail tabs + block picker tests | Product defines block vs aggregate UX |
| **DATA-33d** | 查看全部 CSV | Library emits `view-full-csv` with `{ fileName, text }` (or blob URL). Playground / MSTT host opens the full CSV in a **new tab** (blob URL or editor tab) | Emit + host/playground open | Product specifies host chrome |
| **DATA-33e** | Duration card chrome | **Product confirmed (DATA-1 + UI-32):** `summary.coreCount` from `HardwareInfo.jsonl` by `Op Type` (cube → `ai_cube_count`/`aic_cube_count`; vector → `ai_vector_count`/`aic_vector_count`; mix → `ai_core_count`). Secondary: `{blockDim} / {coreCount}` iterations/core when both set; else `blockDim` only; else `opName`. Bar = `min(100%, Block Dim / core_count × 100%)` when `coreCount` present; else decorative ~15% fill | `PR-STATS-009`–`011`, `PR-STATS-031` | Product changes duration-bar formula |
| **DATA-33f** | PIPE in-bar absolute | **Product confirmed (DATA-18):** `absoluteValue` = **mean of non-`NA` `*_time(us)`** for the same family/side as the ratio (DATA-33b). Omit when all NA. Not cycles | `PR-STATS-013`, adapter unit tests | Product changes in-bar metric |
| **DATA-33g** | I/O bandwidth cards | **Measured (confirmed):** mean of non-`NA` `aic_main_mem_{read\|write}_bw(GB/s)` / `aiv_*` on `Memory.csv` (first matching header only; also accept headers without `(GB/s)`). **Peak (still guess):** **1600 GB/s** for all four aic/aiv × in/out slots — **not** max of measured columns. **Score (still guess):** `round(measured/peak×100)` clamped 0–100 (sketch dummy 81 ≠ ratio). **Bar:** fill = score % of track (8px pill). **Display:** **GB/s** (UI-34; magnitude rounding). **Layout:** same raised card chrome as duration; aic \| aiv columns; sketch **3+2 grid** with duration. **NA side:** omit that aic/aiv column; omit card if both NA. `Report.csv` unused (no schema). | `bandwidthCards`, `PR-VM-013`, `PR-STATS-024` | Product peak source, score formula vs sketch 81, aggregation, `Report.csv` |
| **DATA-32a** | Overview series | Adapter returns `overviewSeries: []`; UI **hides** charts (aligns with Product DATA-32) | No fake series from CSV | Producer defines `OverviewSeries` source |
    30|| **DATA-37a** | Roofline Y (TOps/s) | Achieved performance = mean non-`NA` `aiv_vec_fops` / mean non-`NA` `aiv_time(us)` as `fops / timeUs / 1e6` (Cube: `aic_cube_fops` / `aic_time(us)` when Vector fops absent). Aggregate across blocks like DATA-33b | `RooflinePanel` / adapter tests | Product DATA-37 formulas |
| **DATA-37b** | Roofline X GM (Ops/Byte) | Intensity = same fops / `(mean(read_main_memory_datas(KB)) + mean(write_main_memory_datas(KB))) * 1024` from `Memory.csv` | Adapter GM point | Product DATA-37 |
| **DATA-37c** | Roofline L2 series | **Omit** L2 point (L2Cache has hit counts only, no byte traffic) | Legend GM-only when L2 absent | Product supplies L2 bytes |
| **DATA-37d** | Roofline roof | `peakComputeTops = 1`; `peakBandwidthGBs` = max of non-`NA` `aiv_main_mem_*_bw(GB/s)` / `aic_main_mem_*_bw(GB/s)` (fallback **100** if all NA). Roof TOps/s = `min(peakCompute, peakBW_GBs * intensity / 1000)` | Chart roof polyline | Product peak sources |
| **DATA-37e** | Roofline op-mix | Normalize non-zero Vector `aiv_vec_{fp32,fp16,int32,int16,misc}_ratio` (or Cube `aic_cube_*`) to %; show top contributors | Mix labels on chart | Product mix definition |
| **DATA-37f** | Roofline tabs | **Hide** 内存单元 / 通路 / 搬运 until DATA-37 defines distinct series | Single chart chrome | Product tab semantics |
| **DATA-36a** | Dependency encoding | Chrome Trace `args` convention: `args.event_id` makes an X event addressable (else the adapter's own `e-<seq>` id stands) and `args.dependencies` lists **successor** ids. Predecessors come from a reverse index, never from the producer. Ids that no event carries are dropped. `dependencies` capability + every dependency surface hide when the model has no edges | `buildDependencyGraph` / `neighborsOf` (`PR-DEPGRAPH-*`), `DetailRelevant` (`PR-DREL-*`), playground `deps` fixture | Product defines the real producer encoding (DATA-36) |
| **DATA-34a** | Hardware details panel | **Source confirmed:** `HardwareInfo.jsonl` category sections. Fallback: flat **OpBasicInfo** non-empty columns when jsonl absent. Never invent cores/HBM/peaks. **更多** always opens the overlay (UI-30, UI-31): show `HardwareDetailsPanel` when data exists, else **缺少 hardware info**. Aside meta is **进程** / **算子类型** / **Blocks**, not 核数 / NPU ARCH | `HardwareDetailsPanel`, adapter tests | Product changes HardwareInfo overlay source |
| **UI-40a** | Time units | **Two-tier auto:** viewport/overview **chrome** (axis, cursor) from visible span / axis density; tooltip, detail Start·End·Duration, and measure/gap **Δt** use **per-value** magnitude units (PyPTO-like). **No** manual unit dropdown. **No** clock-cycle mode yet | Formatter + resolvers; `formatTimeAuto` for absolute times | Product specifies cycle mode + frequency source |
| **PKG-1a** | Package identity | Follow [PACKAGING_SUGGESTIONS.md](PACKAGING_SUGGESTIONS.md) as if accepted for scaffold | Repo-root `src/` | Product confirm/change PKG-1 |
| **PKG-2a** | Design system / i18n | Follow [PACKAGING_SUGGESTIONS.md](PACKAGING_SUGGESTIONS.md) as if accepted for scaffold | Ant Design + custom swimlane CSS; zh-CN default + EN keys | Product confirm/change PKG-2 |
| **PKG-3a** | PyPTO copy-paste license | Follow [PACKAGING_SUGGESTIONS.md](PACKAGING_SUGGESTIONS.md) as if accepted for scaffold | Legal before verbatim paste | Product confirm/change PKG-3 |
| **UI-41a** | Gesture parity | Follow [PACKAGING_SUGGESTIONS.md](PACKAGING_SUGGESTIONS.md) as if accepted for scaffold | wheel/slider/drag MVP; W/S/A/D P2 | Product confirm/change UI-41 |
    40|
---

## Product deferrals (current iteration)

Product-confirmed **out of this iteration** — not interim guesses. Shipped `master` must not land these until Product re-schedules.

| ID | Topic | Decision | Parked work | Revisit when |
|----|-------|----------|-------------|--------------|
| **D-PIN-FOLDER** | Pin grouping / folder nodes | **Do not ship** folder (or Card) pin in the current iteration. Shipped pin remains **leaf lanes only** ([INTERACTIONS](../ui/INTERACTIONS.md), `#51`). | Branch `feat/pin-grouping-nodes` — folder + subtree sticky strip (PR [#69](https://github.com/IdeFrontend/profiling-report/pull/69) closed unmerged; branch kept) | Product schedules folder pin |
    50|
---

## MVP scope under interims (checklist)

Allowed to implement now:

1. Tooling scaffold (Vitest, Playwright, playground)
2. `.rep` / `.ncrep` parse (alias) + Chrome Trace → `SwimlaneModel`
3. Standalone Chrome Trace `.json` open path
    60|4. Timeline shell, axis, gutter, swimlane, tooltip, select → detail
5. PIPE bars when `PipeUtilization` present
6. Thin summary (name / type / duration only)
7. Hide overview, undecidable summary tiles, missing panels

Not required for first MVP merge:

- Sketch-faithful multi-core golden
- Full report stats tiles (compute / avg util) — I/O BW shipped under DATA-33g
- Overview charts with real series
    70|- Product-final hardware inventory beyond DATA-34a; roofline tabs / L2 series beyond DATA-37*; memory SVG; deps; secondary tabs
- Clock-cycle display mode

---

## Related specs to keep in sync

- [VIEW_DATA_REQUIREMENTS.md](../formats/VIEW_DATA_REQUIREMENTS.md)
- [FEATURE_MATRIX.md](../ui/FEATURE_MATRIX.md)
- [METRICS_AND_TRACE.md](../formats/METRICS_AND_TRACE.md)
    80|- [REP_FORMAT.md](../formats/REP_FORMAT.md)
- [TESTING.md](../process/TESTING.md)
- [DEVELOPMENT.md](../process/DEVELOPMENT.md)
