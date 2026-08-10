# Interim Engineering Decisions (MVP Unblock)

**These are not Product-final decisions.** They exist so MVP implementation and tests can proceed while producer / data specs are incomplete.

| Rule | Detail |
|------|--------|
| Status label | **Interim** — never write as **Resolved** product truth |
| Supersede | When Product or the format/data spec answers the linked Q*, update that Q to Resolved/Proposed, delete or strike the row here, and fix dependent specs in the **same PR** |
| Tests | Assert interim behavior; titles may note `(interim)` |
| Code comments | Prefer linking this file / Q id over inventing silent TBDs |

Canonical Product answers stay in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md). Packaging proposals that Product has not confirmed: [PACKAGING_SUGGESTIONS.md](PACKAGING_SUGGESTIONS.md) (also interim until accepted).

---

## Interim table (MVP)

| ID | Topic | Interim decision | Implement / test as | Superseded when |
|----|-------|------------------|---------------------|-----------------|
| **I-Q2** | `.ncrep` vs `.rep` | **Same binary layout and magic**; treat as product aliases for one parser | One `RepAdapter`; both extensions open Timeline | Product defines divergence (version field, required embeds) |
| **I-Q4** | Golden fixture | Primary CI/playground fixture = [`data/out.rep`](../../data/out.rep). Acceptance = parse + render + hide rules — **not** sketch pixel-parity | e2e `PR-E2E-001` on `out.rep`; optional later synthetic sketch-like fixture | Sketch-faithful production golden arrives (Product Q4 target) |
| **I-Q6a** | Summary tiles | Show only **clear** `OpBasicInfo` fields: op name, op type, task duration (and freq fields if present as raw values). **Hide** compute TFLOPS, I/O BW, and avg core util tiles. Duration uses sketch card chrome; op type is **not** a separate card | Thin duration card in `StatsAside` | Data/format spec defines formulas (Q6) |
| **I-Q6b** | PIPE aggregation | **Mean of non-`NA` ratios** per pipe family across `block_id` | `PipeOccupancyPanel` unit tests | Q6 / data spec overrides aggregation |
| **I-Q6c** | Block scope vs aggregate | Summary **PIPE bars** stay I-Q6b (mean across blocks). **Detail / memory / metrics** views are **block-scoped** via the block switcher ([`v930/memory-load-detail`](../ui/source/v930/memory-load-detail.jpeg)). Default selected block = first `block_id` in fixture order | Aside detail tabs + block picker tests | Product defines block vs aggregate UX |
| **I-Q6d** | 查看全部 CSV | Library emits `view-full-csv` with `{ fileName, text }` (or blob URL). Playground / MSTT host opens the full CSV in a **new tab** (blob URL or editor tab) | Emit + host/playground open | Product specifies host chrome |
| **I-Q6e** | Duration card chrome | Progress bar is **decorative** (fixed short cyan fill), not a % of peak. Secondary: `blockDim` → iterations/core label; else `opName`; else omit | `PR-STATS-009`–`011` | Product defines duration-bar scale and secondary formula |
| **I-Q6f** | PIPE in-bar absolute | `absoluteValue` = **mean of non-`NA` `*_time(us)`** for the same family/side as the ratio (I-Q6b). Omit when all NA. No cycles→display inventing | `PR-STATS-013`, adapter unit tests | Product defines in-bar metric |
| **I-Q5+** | Overview series | Adapter returns `overviewSeries: []`; UI **hides** charts (aligns with Product Q5) | No fake series from CSV | Producer defines `OverviewSeries` source |
| **I-Q11a** | Roofline Y (TOps/s) | Achieved performance = mean non-`NA` `aiv_vec_fops` / mean non-`NA` `aiv_time(us)` as `fops / timeUs / 1e6` (Cube: `aic_cube_fops` / `aic_time(us)` when Vector fops absent). Aggregate across blocks like I-Q6b | `RooflinePanel` / adapter tests | Product Q11 formulas |
| **I-Q11b** | Roofline X GM (Ops/Byte) | Intensity = same fops / `(mean(read_main_memory_datas(KB)) + mean(write_main_memory_datas(KB))) * 1024` from `Memory.csv` | Adapter GM point | Product Q11 |
| **I-Q11c** | Roofline L2 series | **Omit** L2 point (L2Cache has hit counts only, no byte traffic) | Legend GM-only when L2 absent | Product supplies L2 bytes |
| **I-Q11d** | Roofline roof | `peakComputeTops = 1`; `peakBandwidthGBs` = max of non-`NA` `aiv_main_mem_*_bw(GB/s)` / `aic_main_mem_*_bw(GB/s)` (fallback **100** if all NA). Roof TOps/s = `min(peakCompute, peakBW_GBs * intensity / 1000)` | Chart roof polyline | Product peak sources |
| **I-Q11e** | Roofline op-mix | Normalize non-zero Vector `aiv_vec_{fp32,fp16,int32,int16,misc}_ratio` (or Cube `aic_cube_*`) to %; show top contributors | Mix labels on chart | Product mix definition |
| **I-Q11f** | Roofline tabs | **Hide** 内存单元 / 通路 / 搬运 until Q11 defines distinct series | Single chart chrome | Product tab semantics |
| **I-Q7a** | Hardware details panel | Ship **interim** panel despite Product Q7 “out of MVP”: prefer `HardwareInfo.jsonl` category sections when present; else flat **OpBasicInfo** non-empty columns (raw headers). Never invent cores/HBM/peaks. Omit model when both absent | `HardwareDetailsPanel`, adapter tests | Product hardware inventory / Q7 reopen |
| **I-Q14** | Time units | Configurable display: **ms / µs / ns** only. Default **ms**. **No** clock-cycle mode in MVP | Formatter + host/locale pref prop | Product specifies cycle mode + frequency source |
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
- Full report stats tiles (compute / BW / avg util)
- Overview charts with real series
- Hardware aside, roofline, memory SVG, deps, secondary tabs
- Clock-cycle display mode

---

## Related specs to keep in sync

- [VIEW_DATA_REQUIREMENTS.md](../formats/VIEW_DATA_REQUIREMENTS.md)
- [FEATURE_MATRIX.md](../ui/FEATURE_MATRIX.md)
- [METRICS_AND_TRACE.md](../formats/METRICS_AND_TRACE.md)
- [REP_FORMAT.md](../formats/REP_FORMAT.md)
- [TESTING.md](../process/TESTING.md)
- [DEVELOPMENT.md](../process/DEVELOPMENT.md)
