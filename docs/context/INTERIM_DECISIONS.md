# Interim Engineering Decisions (MVP Unblock)

**These are not Product-final decisions.** They exist so MVP implementation and tests can proceed while producer / data specs are incomplete.

| Rule | Detail |
|------|--------|
| Status label | **Interim** — never write as **Resolved** product truth |
| Supersede | When Product or the format/data spec answers the linked Q*: write the decision into owning specs, **remove** the Q from open lists ([OPEN_QUESTIONS](OPEN_QUESTIONS.md) / [HQ_OPEN_QUESTIONS](HQ_OPEN_QUESTIONS.md)), delete or strike this interim row, and scrub “until Q*” wording — all in the **same change**. See [DEVELOPMENT.md § Resolving open questions](../process/DEVELOPMENT.md#resolving-open-questions). |
| Tests | Assert interim behavior; titles may note `(interim)` |
| Code comments | Prefer linking this file / Q id over inventing silent TBDs |

Canonical Product answers live in the owning **specs** after resolution (see [DEVELOPMENT.md § Resolving open questions](../process/DEVELOPMENT.md#resolving-open-questions)). Open lists hold unanswered items only: [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md), [HQ_OPEN_QUESTIONS.md](HQ_OPEN_QUESTIONS.md). Packaging proposals that Product has not confirmed: [PACKAGING_SUGGESTIONS.md](PACKAGING_SUGGESTIONS.md) (also interim until accepted).

---

## Interim table (MVP)

| ID | Topic | Interim decision | Implement / test as | Superseded when |
|----|-------|------------------|---------------------|-----------------|
| **I-Q2** | `.ncrep` vs `.rep` | **Same binary layout and magic**; treat as product aliases for one parser | One `RepAdapter`; both extensions open Timeline | Product defines divergence (version field, required embeds) |
| **I-Q4** | Golden fixture | Primary CI fixture = [`data/out.rep`](../../data/out.rep) (flat AIV). Acceptance = parse + render + hide rules — **not** sketch pixel-parity. Playground stress `small`/`medium`/`large` emit nested Card → Core → pipe `SwimlaneModel` for sketch hierarchy | e2e `PR-E2E-001` on `out.rep`; stress unit tests for Card tree | Sketch-faithful production golden arrives (Product Q4 target) |
| **I-Q6a** | Summary tiles | Show **confirmed** duration from `OpBasicInfo.csv` `Task Duration(us)`. When duration is present, compute TFLOPS and avg core util tiles stay in the sketch grid as **title + `N/A`** (do not bind guessed values); omit those placeholders when the summary is BW-only so the grid stays rectangular. Duration uses sketch card chrome (bar still I-Q6e). Op type is **not** a separate card. I/O BW → **I-Q6g** | Thin duration card + N/A placeholders in `StatsAside` | Data/format spec defines compute / avg-util formulas (Q6) |
| **I-Q6b** | PIPE aggregation | **Mean of non-`NA` ratios** per pipe family across `block_id` | `PipeOccupancyPanel` unit tests | Q6 / data spec overrides aggregation |
| **I-Q6c** | Block scope vs aggregate | Summary **PIPE bars** stay I-Q6b (mean across blocks). **Detail / memory / metrics** views are **block-scoped** via the block switcher ([`v930/memory-load-detail`](../ui/source/v930/memory-load-detail.jpeg)). Default selected block = first `block_id` in fixture order | Aside detail tabs + block picker tests | Product defines block vs aggregate UX |
| **I-Q6d** | 查看全部 CSV | Library emits `view-full-csv` with `{ fileName, text }` (or blob URL). Playground / MSTT host opens the full CSV in a **new tab** (blob URL or editor tab) | Emit + host/playground open | Product specifies host chrome |
| **I-Q6e** | Duration card chrome | **Product confirmed (HQ 1 + HQ 32):** `summary.coreCount` from `HardwareInfo.jsonl` by `Op Type` (cube → `ai_cube_count`/`aic_cube_count`; vector → `ai_vector_count`/`aic_vector_count`; mix → `ai_core_count`). Secondary: `{blockDim} / {coreCount}` iterations/core when both set; else `blockDim` only; else `opName`. Bar = `min(100%, Block Dim / core_count × 100%)` when `coreCount` present; else decorative ~15% fill | `PR-STATS-009`–`011`, `PR-STATS-031` | Product changes duration-bar formula |
| **I-Q6f** | PIPE in-bar absolute | **Product confirmed (HQ 18):** `absoluteValue` = **mean of non-`NA` `*_time(us)`** for the same family/side as the ratio (I-Q6b). Omit when all NA. Not cycles | `PR-STATS-013`, adapter unit tests | Product changes in-bar metric |
| **I-Q6g** | I/O bandwidth cards | **Measured (confirmed):** mean of non-`NA` `aic_main_mem_{read\|write}_bw(GB/s)` / `aiv_*` on `Memory.csv` (first matching header only; also accept headers without `(GB/s)`). **Peak (still guess):** **1600 GB/s** for all four aic/aiv × in/out slots — **not** max of measured columns. **Score (still guess):** `round(measured/peak×100)` clamped 0–100 (sketch dummy 81 ≠ ratio). **Bar:** fill = score % of track (8px pill). **Display:** **GB/s** (HQ 34; magnitude rounding). **Layout:** same raised card chrome as duration; aic \| aiv columns; sketch **3+2 grid** with duration. **NA side:** omit that aic/aiv column; omit card if both NA. `Report.csv` unused (no schema). | `bandwidthCards`, `PR-VM-013`, `PR-STATS-024` | Product peak source, score formula vs sketch 81, aggregation, `Report.csv` |
| **I-Q5+** | Overview series | Adapter returns `overviewSeries: []`; UI **hides** charts (aligns with Product Q5) | No fake series from CSV | Producer defines `OverviewSeries` source |
| **I-Q11a** | Roofline Y (TOps/s) | Achieved performance = mean non-`NA` `aiv_vec_fops` / mean non-`NA` `aiv_time(us)` as `fops / timeUs / 1e6` (Cube: `aic_cube_fops` / `aic_time(us)` when Vector fops absent). Aggregate across blocks like I-Q6b | `RooflinePanel` / adapter tests | Product Q11 formulas |
| **I-Q11b** | Roofline X GM (Ops/Byte) | Intensity = same fops / `(mean(read_main_memory_datas(KB)) + mean(write_main_memory_datas(KB))) * 1024` from `Memory.csv` | Adapter GM point | Product Q11 |
| **I-Q11c** | Roofline L2 series | **Omit** L2 point (L2Cache has hit counts only, no byte traffic) | Legend GM-only when L2 absent | Product supplies L2 bytes |
| **I-Q11d** | Roofline roof | `peakComputeTops = 1`; `peakBandwidthGBs` = max of non-`NA` `aiv_main_mem_*_bw(GB/s)` / `aic_main_mem_*_bw(GB/s)` (fallback **100** if all NA). Roof TOps/s = `min(peakCompute, peakBW_GBs * intensity / 1000)` | Chart roof polyline | Product peak sources |
| **I-Q11e** | Roofline op-mix | Normalize non-zero Vector `aiv_vec_{fp32,fp16,int32,int16,misc}_ratio` (or Cube `aic_cube_*`) to %; show top contributors | Mix labels on chart | Product mix definition |
| **I-Q11f** | Roofline tabs | **Hide** 内存单元 / 通路 / 搬运 until Q11 defines distinct series | Single chart chrome | Product tab semantics |
| **I-Q9** | Dependency encoding | Chrome Trace `args` convention: `args.event_id` makes an X event addressable (else the adapter's own `e-<seq>` id stands) and `args.dependencies` lists **successor** ids. Predecessors come from a reverse index, never from the producer. Ids that no event carries are dropped. `dependencies` capability + every dependency surface hide when the model has no edges | `buildDependencyGraph` / `neighborsOf` (`PR-DEPGRAPH-*`), `DetailRelevant` (`PR-DREL-*`), playground `deps` fixture | Product defines the real producer encoding (Q9) |
| **I-Q7a** | Hardware details panel | **Source confirmed:** `HardwareInfo.jsonl` category sections. Fallback: flat **OpBasicInfo** non-empty columns when jsonl absent. Never invent cores/HBM/peaks. **更多** always opens the overlay (HQ 30–31): show `HardwareDetailsPanel` when data exists, else **缺少 hardware info**. Aside meta is **进程** / **算子类型** / **Blocks**, not 核数 / NPU ARCH | `HardwareDetailsPanel`, adapter tests | Product changes HardwareInfo overlay source |
| **I-Q14** | Time units | **Two-tier auto:** viewport/overview **chrome** (axis, cursor) from visible span / axis density; tooltip, detail Start·End·Duration, and measure/gap **Δt** use **per-value** magnitude units (PyPTO-like). **No** manual unit dropdown. **No** clock-cycle mode yet | Formatter + resolvers; `formatTimeAuto` for absolute times | Product specifies cycle mode + frequency source |
| **I-Q16–19** | Packaging / UX chrome | Follow [PACKAGING_SUGGESTIONS.md](PACKAGING_SUGGESTIONS.md) as if accepted for scaffold | Repo-root `src/`, Ant Design + custom swimlane CSS, zh-CN default + EN keys, wheel/slider MVP gestures | Product confirm/change each Q16–Q19 |

---

## MVP scope under interims (checklist)

Allowed to implement now:

1. Tooling scaffold (Vitest, Playwright, playground)
2. `.rep` / `.ncrep` parse (alias) + Chrome Trace → `SwimlaneModel`
3. Standalone Chrome Trace `.json` open path
4. Timeline shell, axis, gutter, swimlane, tooltip, select → detail
5. PIPE bars when `PipeUtilization` present
6. Thin summary (name / type / duration only)
7. Hide overview, undecidable summary tiles, missing panels

Not required for first MVP merge:

- Sketch-faithful multi-core golden
- Full report stats tiles (compute / avg util) — I/O BW shipped under I-Q6g
- Overview charts with real series
- Product-final hardware inventory beyond I-Q7a; roofline tabs / L2 series beyond I-Q11*; memory SVG; deps; secondary tabs
- Clock-cycle display mode

---

## Related specs to keep in sync

- [VIEW_DATA_REQUIREMENTS.md](../formats/VIEW_DATA_REQUIREMENTS.md)
- [FEATURE_MATRIX.md](../ui/FEATURE_MATRIX.md)
- [METRICS_AND_TRACE.md](../formats/METRICS_AND_TRACE.md)
- [REP_FORMAT.md](../formats/REP_FORMAT.md)
- [TESTING.md](../process/TESTING.md)
- [DEVELOPMENT.md](../process/DEVELOPMENT.md)
