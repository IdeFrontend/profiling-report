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

## Unit contract

- **barWidth** is always 0–100 (UI **track** percent of the 110px gutter util column). For **both** metrics it is the **same** event-coverage ratio (event duration / model span) — switching the Card dropdown must **not** change bar fill widths, only labels.
- **clockCycle** label values are **absolute clock-cycle counts** from mapped `PipeUtilization.csv` `*_total_cycles`. Labels are **bare integers** (no `µs` / ms / `%` suffix) — [UI-46a](../../docs/context/decisions/interim/UI.md).
- **utilization** labels use **`%`** of that same event coverage (unchanged).
- Time window for coverage is the swimlane model span `[minTime, maxTime]` (full trace), not the visible viewport.
- CSV aggregations ignore `NA` tokens. Until Product picks mean vs sum for multi-`block_id` on clockCycle labels, interim uses **mean** of non-`NA` cells (same pattern as [DATA-28](../../docs/context/decisions/DATA.md)). Do **not** use `*_time(us)` for clockCycle **labels** (aside absolute times stay [DATA-33f](../../docs/context/decisions/interim/DATA.md)).

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

Prefer the columns above. When a per-pipe `*_total_cycles` column is absent (common fixture gap), **derive** absolute cycles as \(\operatorname{mean}(*\_\mathrm{time(us)})\times(\operatorname{mean}(\mathrm{side\_total\_cycles})/\operatorname{mean}(\mathrm{side\_time(us)}))\) using `aic_*` / `aiv_*` block totals for the matching side — labels remain bare cycle counts, never `µs`. Block-level totals alone still do **not** map to a pipe key. Lanes outside the map (or underivable) keep the **shared** event-coverage bar but an **empty** cycle label.

#### Cycle label raw (labels only — not barWidth)

1. For each column \(C\) in a pipe’s set, over CSV rows \(r\):

\[
\operatorname{agg}(C)=\frac{1}{|S_C|}\sum_{r\in S_C} C(r),\quad S_C=\{r:C(r)\neq\texttt{NA}\}
\]

(Interim **mean** across `block_id`; Product may switch to **sum**.) Omit \(C\) entirely when \(S_C=\emptyset\).

2. For a pipe key with columns \(\{C_i\}_{i=1}^{k}\) that each have an aggregate:

\[
\operatorname{raw}_{\mathrm{key}}=\frac{1}{k}\sum_{i=1}^{k}\operatorname{agg}(C_i)
\]

3. **Leaf lane:** \(\operatorname{raw}_{\mathrm{lane}}=\operatorname{raw}_{\mathrm{key}}\) for `laneColorKey(thread.name)`.

4. **Folder / non-leaf:** \(\operatorname{raw}_{\mathrm{folder}}=\sum\operatorname{raw}_{\mathrm{child}}\) over children that have a defined raw (**sum** for the **label** only).

| Output | Formula |
|--------|---------|
| **label** | Bare integer cycle count: `Math.round(raw)` (space-grouped when large). **No** unit suffix. |
| **barWidth** | **Same as utilization** — event coverage over `[minTime, maxTime]` (see below). Switching metric must not change fill width. |
| **thresholdColor** | true (red when barWidth &lt; 50) — same as utilization |
| **midline** | fixed **50%** for both metrics |

### Shared barWidth (both metrics)

`barWidth = round(coverage × 100)` clamped 1..100 when coverage &gt; 0 but rounds to 0; **`0` when coverage is 0**. Coverage = `computeThreadUtilization` / folder **mean** of children (idle included). Full rules: [utilization.spec.md](./utilization.spec.md).

### utilization (summary)

**label** = `` `${barWidth}%` ``. **thresholdColor** = true. Midline **50%**. Bar identical to clockCycle mode.

### Fill / midline (both metrics)

| Metric | Red fill | Dashed average-line position |
|--------|------------------|------------------------------|
| **utilization** | util &lt; 50% (gray at exactly 50%) | fixed **50%** |
| **clockCycle** | same as utilization (shared barWidth) | fixed **50%** |

## Acceptance Criteria

1. **PR-GMET-001** — Returns available metrics; omits clockCycle when CSV lacks mappable `*_total_cycles` (utilization only).
2. **PR-GMET-002** — Default metric is utilization when available, else clockCycle when available, else `null`.
3. **PR-GMET-003** — barWidth is event coverage for **both** metrics (identical fills when switching dropdown); clockCycle does **not** use cycle-sum normalization for bars.
4. **PR-GMET-004** — utilization uses event coverage window and threshold coloring (unchanged).
5. **PR-GMET-005** — Folder **labels** **sum** child cycle raws for clockCycle; folder **barWidth** stays mean coverage.
6. **PR-GMET-006** — Ignores `NA` CSV cells; interim means `*_total_cycles` across `block_id` rows (DATA-28 pattern until Product picks sum).
7. **PR-GMET-007** — `averageBarWidthForCard` is **50** for both metrics.
8. **PR-GMET-008** — `clockCycle` labels: bare rounded integers (no `µs` / unit suffix); uses mapped `*_total_cycles` (or derived) — **not** `*_time(us)` as the displayed quantity.

## Edge Cases

| State | Behavior |
|---|---|
| Chrome Trace only (no CSV) | clockCycle unavailable; utilization only |
| Empty Card subtree | No bars; selector hidden when no modes |
| Flat CTEF (no nested children) | Metrics apply to depth-0 pipe leaves |
| Lane with no matching CSV key | Shared coverage bar; empty cycle label in clockCycle mode |
| Idle utilization leaf (coverage 0) | `0` barWidth (not an empty slot); util label `0%`; included in folder mean |
| MIX op with both aic and aiv columns for one key | Mean of per-column aggregates (e.g. mte2, scalar) |
| Only block-level `aic_total_cycles` / `aiv_total_cycles` (no pipe time) | clockCycle unavailable |
| Per-pipe `*_total_cycles` missing but `*_time(us)` + side totals present | **Derive** absolute cycles (see column map); labels still bare cycles |
| `*_time(us)` alone (no side totals / no pipe cycles) | Cannot form clockCycle **label**; bar still shows coverage |

## Dependencies

[utilization.spec.md](./utilization.spec.md), [view-models.spec.md](./view-models.spec.md), [METRICS_AND_TRACE.md](../../docs/formats/METRICS_AND_TRACE.md), [DATA-28](../../docs/context/decisions/DATA.md) / [DATA-33f / DATA-38a](../../docs/context/decisions/interim/DATA.md), [UI-46a](../../docs/context/decisions/interim/UI.md), [DATA-38](../../docs/context/questions/DATA.md), [UI-46](../../docs/context/questions/UI.md), [LaneGutter.spec.md](../../src/ui/TimelineView/SwimlaneView/LaneGutter/LaneGutter.spec.md), [SwimlaneView.spec.md](../../src/ui/TimelineView/SwimlaneView/SwimlaneView.spec.md).

## Open

**Product confirmation pending** — Clock Cycles **labels** and bare-cycle formatting are **Interim** ([DATA-38a](../../docs/context/decisions/interim/DATA.md), [UI-46a](../../docs/context/decisions/interim/UI.md)). Bar fill is shared event coverage for both metrics (confirmed locally). Confirm: per-pipe `*_total_cycles` map, folder label sum, multi-block mean vs sum, bare labels.

Until Product answers: keep two dropdown items; shared barWidth; clockCycle labels as specified above.

## Changelog
- **2026-09-14** — Shared barWidth: both metrics use event coverage; only labels switch (PR-GMET-003/007).
- **2026-09-14** — DATA-38 interim rewrite: two dropdown items; clockCycle labels = absolute `*_total_cycles`, folder label **sum**, bare cycle labels (PR-GMET-005/006/008).
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
