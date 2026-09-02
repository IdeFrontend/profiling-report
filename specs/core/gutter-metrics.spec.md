# Gutter Metrics

| spec-id-prefix |
|----------------|
| PR-GMET-*      |

Compute per-lane gutter bar display for the Card-header metric selector (PyPTO parity). Maps `.rep` CSV + trace data into `GutterBarDisplay` payloads consumed by `LaneGutter`.

```ts
type GutterMetric = 'clockCycle' | 'cacheHit' | 'task' | 'utilization';

availableGutterMetrics(model, csvRows): GutterMetric[]
defaultGutterMetric(available: GutterMetric[]): GutterMetric
gutterBarsForCard(model, csvRows, metric, cardId): Map<laneId, GutterBarDisplay>
```

## Unit contract

- **barWidth** is always 0–100 (UI percent of the 110px track).
- **label** is a display string only; no unit suffix for cycle counts.
- Time window for **utilization** is the swimlane model span `[minTime, maxTime]` (full trace), not the visible viewport.
- CSV aggregations ignore `NA` tokens; same mean-across-blocks rule as pipe occupancy (I-Q6b) unless a block-scoped mode is added later.

## Behavior

### Supported metrics (PyPTO parity)

| Value | UI label (zh / en via i18n) | Data source (.rep) | Lane matching |
|-------|---------------|-------------------|---------------|
| `clockCycle` | 时钟周期 / Clock Cycle | Mean non-`NA` cycle/time columns from `PipeUtilization.csv` (`aiv_total_cycles`, `aic_*_time(us)`, pipe `*_time(us)` families) | `laneColorKey(thread.name)` — same as pipe ratios |
| `cacheHit` | 缓存命中率 / Cache Hit Ratio | `1 − mean(aiv_icache_miss_rate)` / `1 − mean(aic_icache_miss_rate)` per side | icache columns; map to Scalar/ICache lanes when present |
| `task` | 任务 / Task | Count of `SwimEvent` on each leaf thread | Direct from trace tree |
| `utilization` | 利用率 / Utilization | Event coverage: `computeThreadUtilization(thread, minTime, maxTime)` | Per [utilization.spec.md](./utilization.spec.md) |

### Availability (hide rules)

Mirror PyPTO conditional options **per Card**:

1. **clockCycle** — offer only when `PipeUtilization.csv` yields at least one cycle/time column with a non-`NA` mean mappable to a lane under that Card.
2. **cacheHit** — offer only when `*_icache_miss_rate` columns yield a computable hit rate for at least one lane.
3. **task** — offer when the Card subtree has at least one leaf with events (always on trace-backed reports).
4. **utilization** — offer when the Card subtree has trace lanes (always on trace-backed reports).

When **clockCycle** is unavailable, default to **task** if events exist, else **utilization**.

### PyPTO reference (`swimGraphThreadLabels.vue`)

Parity target: PyPTO gutter util bars (`getBackground`, `threadFillWidth`, `averageValue` in `SwimGraphProcessItem.vue` metric dropdown). **Resolved:** no absolute “&gt; N tasks → red” threshold for **task** (or clockCycle / cacheHit). Red is **relative** within the Card.

| Metric | Red fill (PyPTO) | Dashed average-line position |
|--------|------------------|------------------------------|
| **utilization** | util ≤ 50% (low util flagged) | fixed **50%** |
| **clockCycle** | lane(s) at max (`fillWidth === 100`); all gray when all lanes tie | `(mean ÷ max) × 100` |
| **cacheHit** | same — max lane(s) | `(mean ÷ max) × 100` |
| **task** | same — max lane(s) | `(mean ÷ max) × 100` |

Dash position and red boundary are **different concepts** for the three relative metrics: the line marks the Card average; red marks the max lane only.

### barWidth and label

**clockCycle, cacheHit, task (relative modes).** Among visible lanes in the Card subtree, find the maximum raw value `max`. Each lane: `barWidth = (value / max) × 100` (0 when `max === 0`). **label** = formatted raw value (integer for cycles/tasks; two decimal places for hit rate). **thresholdColor** = false. **relativeMax** = true when `raw === max` and not all lanes tie; otherwise false (all gray when tied). Never use an absolute raw-value threshold for red on these metrics.

**utilization.** `barWidth = round(coverage × 100)` clamped 1..100 when coverage &gt; 0 but rounds to 0 (PyPTO floor). **label** = `` `${barWidth}%` ``. **thresholdColor** = true (red when **≤ 50%**, gray when &gt; 50%). **relativeMax** omitted.

**Folder rollups.** Non-leaf nodes: **barWidth** and numeric backing value = **mean of child values** (same as `meanUtilization()` in swim tree). **label** follows the active metric format applied to the rolled-up value. **task** folders sum child event counts instead of mean.

**Category presentation constants** (通信 = 100%, 储存HBM = 46% in stress presets) remain mockup placeholders until the producer supplies real category metrics; document as non-normative in stress fixtures only.

### Midline (average marker)

- **utilization:** fixed at **50%** of track width (PyPTO `averageValue` for util mode).
- **Other metrics:** `averageBarWidth = mean(lane barWidth)` (= `(mean raw ÷ max raw) × 100`) when at least two lanes have bars; omit midline when fewer than two.

Export `averageBarWidthForCard(bars, metric)` for the UI layer.

## Acceptance Criteria

1. **PR-GMET-001** — Returns available metrics per hide rules; omits clockCycle/cacheHit when CSV lacks columns.
2. **PR-GMET-002** — Default metric is clockCycle when available, else task, else utilization.
3. **PR-GMET-003** — clockCycle/cacheHit/task barWidth normalizes to max lane in Card.
4. **PR-GMET-004** — utilization uses event coverage window and threshold coloring.
5. **PR-GMET-005** — Folder rollups: mean for ratio-like metrics; sum for task counts.
6. **PR-GMET-006** — Ignores `NA` CSV cells; uses mean across `block_id` rows (I-Q6b).
7. **PR-GMET-007** — `averageBarWidthForCard`: 50 for utilization; mean barWidth for relative metrics when ≥2 lanes.

## Edge Cases

| State | Behavior |
|---|---|
| Chrome Trace only (no CSV) | clockCycle and cacheHit unavailable; task + utilization only |
| Empty Card subtree | No bars; selector hidden |
| Flat CTEF (no nested children) | Metrics apply to depth-0 pipe leaves |
| Lane with no matching CSV key | Empty bar slot (no fill, no label) |
| MIX op with both aic and aiv columns | Same `laneColorKey` blending as pipe occupancy (mean when both sides contribute) |

## Dependencies

[utilization.spec.md](./utilization.spec.md), [view-models.spec.md](./view-models.spec.md), [LaneGutter.spec.md](../../src/ui/TimelineView/SwimlaneView/LaneGutter/LaneGutter.spec.md), [SwimlaneView.spec.md](../../src/ui/TimelineView/SwimlaneView/SwimlaneView.spec.md).

## Open

Cycle-column precedence for MIX ops when Cube and Vector both map to the same lane key — interim uses existing `laneColorKey` mean (same as PR-VM-002 pipe attach).

## Changelog
- **2026-08-27** — PyPTO parity locked: max-lane red, mean midline, no absolute task threshold; `relativeMax` + `averageBarWidthForCard`.
- **2026-08-27** — Initial spec: PyPTO parity metrics, .rep mapping, hide rules.
