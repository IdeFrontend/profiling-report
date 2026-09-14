# Gutter Metrics

| spec-id-prefix |
|----------------|
| PR-GMET-*      |

Compute per-lane gutter bar display for the Card-header metric selector. Maps `.rep` CSV + trace data into `GutterBarDisplay` payloads consumed by `LaneGutter`.

```ts
type GutterMetric = 'clockCycle' | 'utilization'

availableGutterMetrics(model, csvRows): GutterMetric[]
defaultGutterMetric(available: GutterMetric[]): GutterMetric | null
gutterBarsForCard(model, csvRows, metric, cardId): Map<laneId, GutterBarDisplay>
```

## Unit contract

- **barWidth** is always 0–100 (UI **track** percent of the 110px gutter util column). It is **not** the physical unit of the metric.
- **clockCycle** raw values are **absolute clock-cycle counts** from mapped `PipeUtilization.csv` `*_total_cycles`. Labels are **bare integers** (no `µs` / ms / `%` suffix) — [UI-46a](../../docs/context/decisions/interim/UI.md).
- **utilization** labels use **`%`** of event coverage over the model span (unchanged).
- Time window for **utilization** is the swimlane model span `[minTime, maxTime]` (full trace), not the visible viewport.
- CSV aggregations ignore `NA` tokens. Until Product picks mean vs sum for multi-`block_id` on clockCycle, interim uses **mean** of non-`NA` cells (same pattern as [DATA-28](../../docs/context/decisions/DATA.md)). Do **not** use `*_time(us)` for clockCycle raw (aside absolute times stay [DATA-33f](../../docs/context/decisions/interim/DATA.md)).

## Behavior

### Supported metrics

| Value | UI label (zh / en via i18n) | Quantity (normative) | Data source |
|-------|---------------|-------------------|---------------|
| `utilization` | 利用率 / Utilization | Event coverage ratio 0..1 | `computeThreadUtilization(thread, minTime, maxTime)` per [utilization.spec.md](./utilization.spec.md) |
| `clockCycle` | 时钟周期 / Clock Cycle | Absolute pipe **clock cycles** | `PipeUtilization.csv` mapped `*_total_cycles` columns only |

**Selector.** Exactly **two** selectable Card-header items when both are available. **Utilization** is unchanged (maps to Product 耗时占比). **Clock Cycles** uses the formula below. Do **not** reintroduce `cacheHit` / `task` without a new spec pass.

**Naming note.** The product string **时钟周期 / Clock Cycle** is the Card-dropdown label. The measured quantity is **cycle counts**, not µs. Do **not** read `*_time(us)` for this metric.

### Availability (hide rules)

Per Card:

1. **utilization** — offer when the Card subtree has trace lanes (always on trace-backed reports).
2. **clockCycle** — offer only when `PipeUtilization.csv` yields at least one mapped `*_total_cycles` column with a non-`NA` aggregate for a lane under that Card.

When **utilization** is unavailable, default to **clockCycle**. When neither is available, return `null`.

### clockCycle formula (normative)

Source file: embedded **`PipeUtilization.csv`** inside `.rep` / `.ncrep` ([METRICS_AND_TRACE.md](../../docs/formats/METRICS_AND_TRACE.md) § PipeUtilization.csv). Interim: [DATA-38a](../../docs/context/decisions/interim/DATA.md).

#### Column → `laneColorKey` map

Parallel rename of the former `*_time(us)` map — replace `_time(us)` with `_total_cycles`:

| `laneColorKey` | CSV column(s) |
|----------------|---------------|
| `cube` | `aic_cube_total_cycles` |
| `mte1` | `aic_mte1_total_cycles` |
| `mte2` | `aic_mte2_total_cycles`, `aiv_mte2_total_cycles` |
| `mte3` | `aiv_mte3_total_cycles` |
| `fixp` | `aic_fixpipe_total_cycles` |
| `scalar` | `aic_scalar_total_cycles`, `aiv_scalar_total_cycles` |
| `vector` | `aiv_vec_total_cycles` |

No other columns feed clockCycle. Block-level `aic_total_cycles` / `aiv_total_cycles` alone do **not** map to a pipe `laneColorKey` (fixture gap — many samples lack per-pipe cycle columns). Lanes whose `laneColorKey(thread.name)` is outside this map (or all cells `NA`) get an **empty** util slot.

#### Raw value

1. For each column \(C\) in a pipe’s set, over CSV rows \(r\):

\[
\operatorname{agg}(C)=\frac{1}{|S_C|}\sum_{r\in S_C} C(r),\quad S_C=\{r:C(r)\neq\texttt{NA}\}
\]

(Interim **mean** across `block_id`; Product may switch to **sum**.) Omit \(C\) entirely when \(S_C=\emptyset\).

2. For a pipe key with columns \(\{C_i\}_{i=1}^{k}\) that each have an aggregate:

\[
\operatorname{raw}_{\mathrm{key}}=\frac{1}{k}\sum_{i=1}^{k}\operatorname{agg}(C_i)
\]

(One-column keys are just that column’s aggregate.)

3. **Leaf lane:** \(\operatorname{raw}_{\mathrm{lane}}=\operatorname{raw}_{\mathrm{key}}\) for `laneColorKey(thread.name)`.

4. **Folder / non-leaf:** \(\operatorname{raw}_{\mathrm{folder}}=\sum\operatorname{raw}_{\mathrm{child}}\) over children that have a defined raw (**sum** rollup, not mean).

#### Report-wide total and display

Let \(L\) be the set of all leaf lanes in the **entire report** (all Cards) that have a defined clockCycle raw. Let

\[
T=\sum_{\ell\in L}\operatorname{raw}_{\ell}
\]

(When \(T=0\), all barWidths are 0.) Grouping nodes under any Card still show \(\operatorname{raw}=\sum\) children; the report root’s raw equals \(T\), so its barWidth is **100%**.

| Output | Formula |
|--------|---------|
| **label** | Bare integer cycle count: `Math.round(raw)` (space-grouped for readability when large). **No** unit suffix. Never show bare `0` when \(raw>0\) after rounding — show at least `1` only if Product later requires; interim: round half away from zero / standard `Math.round`. |
| **barWidth** | \((\operatorname{raw}/T)\times 100\) (0 when \(T=0\)). Share of **report-wide** cycle sum — **not** max-within-Card. |
| **relativeMax** (red fill) | Within the Card’s set \(V\) of raws that have a bar: \(\operatorname{raw}=\max V\) and not all values in \(V\) equal; else false. |
| **midline** (`averageBarWidth`) | Mean of barWidths in the Card when \(\lvert V\rvert\ge 2\); omit otherwise. |

**Parallel pipes:** \(T\) can exceed any single-core or wall-timeline cycle budget because pipes overlap. Interim accepts that for the 100% baseline pending Product confirm.

### utilization (summary)

`barWidth = round(coverage × 100)` clamped 1..100 when coverage &gt; 0 but rounds to 0; **`0` when coverage is 0** (idle lanes keep a defined bar, not an empty slot). **label** = `` `${barWidth}%` ``. **thresholdColor** = true (red when **&lt; 50%**, gray when ≥ 50% — matches LaneGutter `barWidth < 50`). Midline fixed at **50%**. Folder means include idle children. Full rules: [utilization.spec.md](./utilization.spec.md). **Unchanged** by DATA-38 interim rewrite.

### Fill / midline (both metrics)

| Metric | Red fill | Dashed average-line position |
|--------|------------------|------------------------------|
| **utilization** | util &lt; 50% (gray at exactly 50%) | fixed **50%** |
| **clockCycle** | lane(s) at max raw within Card; all gray when tied | mean of Card barWidths when ≥2 lanes |

## Acceptance Criteria

1. **PR-GMET-001** — Returns available metrics; omits clockCycle when CSV lacks mappable `*_total_cycles` (utilization only).
2. **PR-GMET-002** — Default metric is utilization when available, else clockCycle when available, else `null`.
3. **PR-GMET-003** — clockCycle barWidth = \((\mathrm{raw}/T)\times 100\) with \(T\) = report-wide sum of leaf clockCycle raws (report root = 100%).
4. **PR-GMET-004** — utilization uses event coverage window and threshold coloring (unchanged).
5. **PR-GMET-005** — Folder rollups **sum** child raws for clockCycle.
6. **PR-GMET-006** — Ignores `NA` CSV cells; interim means `*_total_cycles` across `block_id` rows (DATA-28 pattern until Product picks sum).
7. **PR-GMET-007** — `averageBarWidthForCard`: 50 for utilization; mean of Card barWidths for clockCycle when ≥2 lanes.
8. **PR-GMET-008** — `clockCycle` labels: bare rounded integers (no `µs` / unit suffix); uses mapped `*_total_cycles` only — **not** `*_time(us)`.

## Edge Cases

| State | Behavior |
|---|---|
| Chrome Trace only (no CSV) | clockCycle unavailable; utilization only |
| Empty Card subtree | No bars; selector hidden when no modes |
| Flat CTEF (no nested children) | Metrics apply to depth-0 pipe leaves |
| Lane with no matching CSV key | Empty bar slot (no fill, no label) for clockCycle |
| Idle utilization leaf (coverage 0) | `0%` bar (not an empty slot); included in folder mean |
| MIX op with both aic and aiv columns for one key | Mean of per-column aggregates (e.g. mte2, scalar) |
| Only block-level `aic_total_cycles` / `aiv_total_cycles` | clockCycle unavailable until per-pipe mapped columns exist (or Product remaps) |
| `*_time(us)` present in CSV | **Ignored** for gutter clockCycle |

## Dependencies

[utilization.spec.md](./utilization.spec.md), [view-models.spec.md](./view-models.spec.md), [METRICS_AND_TRACE.md](../../docs/formats/METRICS_AND_TRACE.md), [DATA-28](../../docs/context/decisions/DATA.md) / [DATA-33f / DATA-38a](../../docs/context/decisions/interim/DATA.md), [UI-46a](../../docs/context/decisions/interim/UI.md), [DATA-38](../../docs/context/questions/DATA.md), [UI-46](../../docs/context/questions/UI.md), [LaneGutter.spec.md](../../src/ui/TimelineView/SwimlaneView/LaneGutter/LaneGutter.spec.md), [SwimlaneView.spec.md](../../src/ui/TimelineView/SwimlaneView/SwimlaneView.spec.md).

## Open

**Product confirmation pending** — Clock Cycles formula and bare-cycle labels are **Interim** ([DATA-38a](../../docs/context/decisions/interim/DATA.md), [UI-46a](../../docs/context/decisions/interim/UI.md), [DATA-38](../../docs/context/questions/DATA.md), [UI-46](../../docs/context/questions/UI.md)). Confirm: per-pipe `*_total_cycles` map, report-wide denom, sum rollup, multi-block mean vs sum, parallel-pipe oversum, bare labels.

Until Product answers: keep two dropdown items; utilization unchanged; clockCycle as specified above.

## Changelog
- **2026-09-14** — DATA-38 interim rewrite: two dropdown items (utilization unchanged + clockCycle); clockCycle = absolute `*_total_cycles`, report-wide sum denom, folder **sum**, bare cycle labels (PR-GMET-003/005/006/008).
- **2026-09-09** — Default Card metric is utilization when available; empty availability returns `null` (PR-GMET-002).
- **2026-09-05** — Document PyPTO PMU sum-of-`total cycle` as reference; note NPU-Compute.md, PR #74, and scanned fixtures lack event-level PMU (interim stays `*_time(us)`).
- **2026-09-05** — Remap gutter label-units ask to **UI-46** / **UI-46a** (do not reuse the id reserved on PR #23 for timeline CPU clocks).
- **2026-09-04** — Utilization idle leaves (`coverage = 0`) keep a `0%` bar and count in folder means (PR-GMET-004).
- **2026-09-04** — Remap interim ask to **DATA-38** / **UI-46** (was Q24 / HQ 39–40) after open-question ID unify; avoid collision with timeline CPU clocks (old OPEN Q23 / HQ 38).
- **2026-09-04** — Mark clockCycle formula + `µs` labels as Interim pending Product via DATA-38 / UI-46 / DATA-38a / UI-46a.
- **2026-09-03** — Normative clockCycle formula: `*_time(us)` only (µs); explicit column map; forbid cycle-count columns; resolve name-vs-quantity wording.
- **2026-09-03** — Drop `cacheHit` and `task`; only `clockCycle` + `utilization`.
- **2026-09-03** — `clockCycle` labels append `µs` so mean `*_time(us)` is not read as % / ratio (PR-GMET-008).
- **2026-09-02** — `clockCycle` labels keep decimals when rounding would show `0` on fractional `*_time(us)` (PR-GMET-008).
- **2026-08-27** — PyPTO parity locked: max-lane red, mean midline; `relativeMax` + `averageBarWidthForCard`.
- **2026-08-27** — Initial spec: PyPTO parity metrics, .rep mapping, hide rules.
