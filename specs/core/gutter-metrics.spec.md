# Gutter Metrics

| spec-id-prefix |
|----------------|
| PR-GMET-*      |

Compute per-lane gutter bar display for the Card-header metric selector. Maps `.rep` CSV + trace data into `GutterBarDisplay` payloads consumed by `LaneGutter`.

```ts
type GutterMetric = 'clockCycle' | 'utilization';

availableGutterMetrics(model, csvRows): GutterMetric[]
defaultGutterMetric(available: GutterMetric[]): GutterMetric
gutterBarsForCard(model, csvRows, metric, cardId): Map<laneId, GutterBarDisplay>
```

## Unit contract

- **barWidth** is always 0–100 (UI **track** percent of the 110px gutter util column). It is **not** the physical unit of the metric.
- **clockCycle** raw values and labels are **microseconds** of pipe active time (`*_time(us)`), never cycle counts and never percents. Label always ends with **`µs`** (same glyph as `formatTime`).
- **utilization** labels use **`%`** of event coverage over the model span.
- Time window for **utilization** is the swimlane model span `[minTime, maxTime]` (full trace), not the visible viewport.
- CSV aggregations ignore `NA` tokens. Mean-across-`block_id` uses the same aggregation **pattern** as pipe occupancy ([DATA-33b](../../docs/context/decisions/interim/DATA.md)); for clockCycle the averaged cells are **`*_time(us)`**, matching aside absolute time ([DATA-33f](../../docs/context/decisions/interim/DATA.md): mean non-`NA` `*_time(us)`, **not cycles**).

## Behavior

### Supported metrics

| Value | UI label (zh / en via i18n) | Quantity (normative) | Data source |
|-------|---------------|-------------------|---------------|
| `clockCycle` | 时钟周期 / Clock Cycle | Mean pipe **active time (µs)** | `PipeUtilization.csv` `*_time(us)` columns only |
| `utilization` | 利用率 / Utilization | Event coverage ratio 0..1 | `computeThreadUtilization(thread, minTime, maxTime)` per [utilization.spec.md](./utilization.spec.md) |

**Naming note.** The product string **时钟周期 / Clock Cycle** is the Card-dropdown label (PyPTO wording). The **measured quantity is µs**, not CPU/NPU cycle counts. Do **not** read `aiv_total_cycles` / `aic_*_cycles` for this metric. Do **not** reintroduce `cacheHit` / `task` without a new spec pass.

### Availability (hide rules)

Per Card:

1. **clockCycle** — offer only when `PipeUtilization.csv` yields at least one mapped `*_time(us)` column with a non-`NA` mean for a lane under that Card.
2. **utilization** — offer when the Card subtree has trace lanes (always on trace-backed reports).

When **clockCycle** is unavailable, default to **utilization**.

### clockCycle formula (normative)

Source file: embedded **`PipeUtilization.csv`** inside `.rep` / `.ncrep` ([METRICS_AND_TRACE.md](../../docs/formats/METRICS_AND_TRACE.md) § PipeUtilization.csv).

#### Column → `laneColorKey` map

| `laneColorKey` | CSV column(s) |
|----------------|---------------|
| `cube` | `aic_cube_time(us)` |
| `mte1` | `aic_mte1_time(us)` |
| `mte2` | `aic_mte2_time(us)`, `aiv_mte2_time(us)` |
| `mte3` | `aiv_mte3_time(us)` |
| `fixp` | `aic_fixpipe_time(us)` |
| `scalar` | `aic_scalar_time(us)`, `aiv_scalar_time(us)` |
| `vector` | `aiv_vec_time(us)` |

No other columns feed clockCycle. Lanes whose `laneColorKey(thread.name)` is outside this map (or all cells `NA`) get an **empty** util slot.

#### Raw value

1. For each column \(C\) in a pipe’s set, over CSV rows \(r\):

\[
\operatorname{mean}(C)=\frac{1}{|S_C|}\sum_{r\in S_C} C(r),\quad S_C=\{r:C(r)\neq\texttt{NA}\}
\]

Omit \(C\) entirely when \(S_C=\emptyset\).

2. For a pipe key with columns \(\{C_i\}_{i=1}^{k}\) that each have a mean:

\[
\operatorname{raw}_{\mathrm{key}}=\frac{1}{k}\sum_{i=1}^{k}\operatorname{mean}(C_i)
\]

(One-column keys are just that column’s mean.)

3. **Leaf lane:** \(\operatorname{raw}_{\mathrm{lane}}=\operatorname{raw}_{\mathrm{key}}\) for `laneColorKey(thread.name)`.

4. **Folder / non-leaf:** \(\operatorname{raw}_{\mathrm{folder}}=\operatorname{mean}(\operatorname{raw}_{\mathrm{child}})\) over children that have a defined raw (same mean rollup as util folders).

#### Display within one Card

Let \(V\) be the set of raw values for lanes/folders under the Card that have a bar; \(M=\max V\).

| Output | Formula |
|--------|---------|
| **label** | Format \(\operatorname{raw}\) then append **`µs`**: `Math.round(raw)` when \(\lvert raw\rvert\ge 0.5\) or \(raw=0\); else `toFixed(2)` when \(raw\ge 0.01\); else `toPrecision(2)`. Never show bare `0` when \(raw>0\). |
| **barWidth** | \((\operatorname{raw}/M)\times 100\) (0 when \(M=0\)). Track fill only — **not** a percent of wall time. |
| **relativeMax** (red fill) | \(\operatorname{raw}=M\) and not all values in \(V\) equal; else false (all gray when tied). |
| **midline** (`averageBarWidth`) | \((\operatorname{mean}(V)/M)\times 100\) when \(\lvert V\rvert\ge 2\); omit otherwise. |

### utilization (summary)

`barWidth = round(coverage × 100)` clamped 1..100 when coverage &gt; 0 but rounds to 0. **label** = `` `${barWidth}%` ``. **thresholdColor** = true (red when **&lt; 50%**, gray when ≥ 50% — matches LaneGutter `barWidth < 50`). Midline fixed at **50%**. Full rules: [utilization.spec.md](./utilization.spec.md).

### Fill / midline (both metrics)

| Metric | Red fill | Dashed average-line position |
|--------|------------------|------------------------------|
| **utilization** | util &lt; 50% (gray at exactly 50%) | fixed **50%** |
| **clockCycle** | lane(s) at max; all gray when tied | `(mean raw ÷ max raw) × 100` |

## Acceptance Criteria

1. **PR-GMET-001** — Returns available metrics; omits clockCycle when CSV lacks mappable `*_time(us)` (utilization only).
2. **PR-GMET-002** — Default metric is clockCycle when available, else utilization.
3. **PR-GMET-003** — clockCycle barWidth normalizes to max lane in Card.
4. **PR-GMET-004** — utilization uses event coverage window and threshold coloring.
5. **PR-GMET-005** — Folder rollups mean child values for clockCycle.
6. **PR-GMET-006** — Ignores `NA` CSV cells; means `*_time(us)` across `block_id` rows (I-Q6b pattern / I-Q6f quantity).
7. **PR-GMET-007** — `averageBarWidthForCard`: 50 for utilization; mean barWidth for clockCycle when ≥2 lanes.
8. **PR-GMET-008** — `clockCycle` labels: integer when `|raw| ≥ 0.5`; otherwise two decimals (or `toPrecision(2)` when `raw < 0.01`); always suffix **`µs`**; never uses cycle-count columns.

## Edge Cases

| State | Behavior |
|---|---|
| Chrome Trace only (no CSV) | clockCycle unavailable; utilization only |
| Empty Card subtree | No bars; selector hidden when no modes |
| Flat CTEF (no nested children) | Metrics apply to depth-0 pipe leaves |
| Lane with no matching CSV key | Empty bar slot (no fill, no label) for clockCycle |
| MIX op with both aic and aiv columns for one key | Mean of per-column means (e.g. mte2, scalar) |
| Fractional time mean &lt; 0.5 | Label shows decimals with unit (e.g. `0.31µs`), not `0` or bare `0.31` |
| `*_total_cycles` present in CSV | **Ignored** for gutter clockCycle |

## Dependencies

[utilization.spec.md](./utilization.spec.md), [view-models.spec.md](./view-models.spec.md), [METRICS_AND_TRACE.md](../../docs/formats/METRICS_AND_TRACE.md), [DATA-33b / DATA-33f / DATA-38a](../../docs/context/decisions/interim/DATA.md), [UI-45a](../../docs/context/decisions/interim/UI.md), [DATA-38](../../docs/context/questions/DATA.md), [UI-45](../../docs/context/questions/UI.md), [LaneGutter.spec.md](../../src/ui/TimelineView/SwimlaneView/LaneGutter/LaneGutter.spec.md), [SwimlaneView.spec.md](../../src/ui/TimelineView/SwimlaneView/SwimlaneView.spec.md).

## Open

**Product confirmation pending** — formula and **`µs`** presentation are **Interim** engineering defaults ([DATA-38a](../../docs/context/decisions/interim/DATA.md), [UI-45a](../../docs/context/decisions/interim/UI.md), [DATA-38](../../docs/context/questions/DATA.md), [UI-45](../../docs/context/questions/UI.md)). Until Product answers DATA-38 / UI-45: keep the column map, mean-across-blocks `*_time(us)` raw, relative barWidth, and `µs` labels as specified above. MIX keys that share one `laneColorKey` keep mean-of-column-means until Product defines another blend.

## Changelog
- **2026-09-04** — Mark clockCycle formula + `µs` labels as Interim pending Product via DATA-38 / UI-45 / DATA-38a / UI-45a.
- **2026-09-03** — Normative clockCycle formula: `*_time(us)` only (µs); explicit column map; forbid cycle-count columns; resolve name-vs-quantity wording.
- **2026-09-03** — Drop `cacheHit` and `task`; only `clockCycle` + `utilization`.
- **2026-09-03** — `clockCycle` labels append `µs` so mean `*_time(us)` is not read as % / ratio (PR-GMET-008).
- **2026-09-02** — `clockCycle` labels keep decimals when rounding would show `0` on fractional `*_time(us)` (PR-GMET-008).
- **2026-08-27** — PyPTO parity locked: max-lane red, mean midline; `relativeMax` + `averageBarWidthForCard`.
- **2026-08-27** — Initial spec: PyPTO parity metrics, .rep mapping, hide rules.
