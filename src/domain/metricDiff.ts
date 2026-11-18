/**
 * Baseline comparison math for the summary cards (对比基线).
 *
 * Pure module — no Vue/DOM imports. Deep-import only; the aside (and later
 * PIPE / roofline / topology slices) consume it, so the sign convention lives
 * in exactly one place:
 *
 *   delta = baseline − current
 *   delta > 0  → the current value DECREASED vs baseline → tone 'decrease'
 *   delta < 0  → the current value INCREASED vs baseline → tone 'increase'
 *
 * `tone` is the DIRECTION of change only. Improvement-vs-regression colouring
 * is metric-valence-dependent (duration is lower-is-better; utilization,
 * TFLOPs and GB/s are higher-is-better) and is the CONSUMER's mapping — this
 * module deliberately does not paint arrows.
 *
 * A diff renders only when BOTH values exist and the difference is non-zero
 * at the display precision (2 decimals); the displayed magnitude is unsigned
 * (the mockup prints no +/−).
 */

export type DiffTone = 'increase' | 'decrease';

export interface MetricDiff {
  tone: DiffTone;
  /** Signed delta = baseline − current (kept for callers that need the sign). */
  delta: number;
  /** Unsigned magnitude for display. */
  magnitude: number;
}

/** Null for missing/non-finite inputs or a zero difference (nothing to show). */
export function metricDiff(current: number | undefined, baseline: number | undefined): MetricDiff | null {
  if (
    current == null
    || baseline == null
    || !Number.isFinite(current)
    || !Number.isFinite(baseline)
  ) {
    return null;
  }
  const delta = baseline - current;
  // Suppress on the DISPLAYED value: the label prints 2 decimals, so a delta
  // that trims to '0' (1e-4 noise, float dust like 0.29 * 100) is invisible
  // and must not light an arrow. Exact `=== 0` alone would miss both — this
  // is the rule the consumer used to re-apply downstream.
  if (delta === 0 || trimDiffMagnitude(Math.abs(delta)) === '0') return null;
  return {
    tone: delta > 0 ? 'decrease' : 'increase',
    delta,
    magnitude: Math.abs(delta),
  };
}

/** measured ÷ peak × 100 (percentage points). Null when the peak is unusable or
 *  the measured fraction is not a usable 0..∞ ratio (negative or non-finite —
 *  producer fixtures carry `parallelBalance: -0.42`). Above-peak values stay
 *  unclamped (fixtures carry `parallelUtilization: 1.5`): the card renders
 *  what the producer reported. */
export function utilizationPercent(measured: number | undefined, peak: number | undefined): number | null {
  if (
    measured == null
    || peak == null
    || !Number.isFinite(measured)
    || !Number.isFinite(peak)
    || measured < 0
    || peak <= 0
  ) {
    return null;
  }
  return (measured / peak) * 100;
}

export interface SideThroughput {
  measuredTflops?: number;
  peakTflops?: number;
}

export interface DirectionThroughput {
  measuredGBs?: number;
  peakGBs?: number;
}

/** Raw card metrics for one report side — what the summary cards display. */
export interface SummaryMetricValues {
  /** µs (diffed raw; the view converts to the card's display unit). */
  taskDurationUs?: number;
  /** Fractions 0..1 (diffed in percentage points). */
  parallelUtilization?: number;
  parallelBalance?: number;
  compute?: {
    aic?: SideThroughput;
    aiv?: SideThroughput;
  };
  bandwidth?: {
    read?: DirectionThroughput;
    write?: DirectionThroughput;
  };
}

export interface SummaryDiffs {
  taskDurationUs: MetricDiff | null;
  parallelUtilization: MetricDiff | null;
  parallelBalance: MetricDiff | null;
  computeAic: MetricDiff | null;
  computeAiv: MetricDiff | null;
  bandwidthRead: MetricDiff | null;
  bandwidthWrite: MetricDiff | null;
}

/**
 * Per-metric diffs between two reports. Duration is diffed in raw µs; the
 * derived metrics (parallel fractions, compute, bandwidth) are converted to
 * percentage points first so the delta carries the card's own unit.
 */
export function summaryDiffs(current: SummaryMetricValues, baseline: SummaryMetricValues): SummaryDiffs {
  const computeSide = (side: keyof NonNullable<SummaryMetricValues['compute']>): MetricDiff | null => {
    const cur = current.compute?.[side];
    const base = baseline.compute?.[side];
    return metricDiff(
      utilizationPercent(cur?.measuredTflops, cur?.peakTflops) ?? undefined,
      utilizationPercent(base?.measuredTflops, base?.peakTflops) ?? undefined,
    );
  };
  const bwDir = (dir: keyof NonNullable<SummaryMetricValues['bandwidth']>): MetricDiff | null => {
    const cur = current.bandwidth?.[dir];
    const base = baseline.bandwidth?.[dir];
    return metricDiff(
      utilizationPercent(cur?.measuredGBs, cur?.peakGBs) ?? undefined,
      utilizationPercent(base?.measuredGBs, base?.peakGBs) ?? undefined,
    );
  };
  return {
    taskDurationUs: metricDiff(current.taskDurationUs, baseline.taskDurationUs),
    parallelUtilization: metricDiff(
      utilizationPercent(current.parallelUtilization, 1) ?? undefined,
      utilizationPercent(baseline.parallelUtilization, 1) ?? undefined,
    ),
    parallelBalance: metricDiff(
      utilizationPercent(current.parallelBalance, 1) ?? undefined,
      utilizationPercent(baseline.parallelBalance, 1) ?? undefined,
    ),
    computeAic: computeSide('aic'),
    computeAiv: computeSide('aiv'),
    bandwidthRead: bwDir('read'),
    bandwidthWrite: bwDir('write'),
  };
}

/** 2 decimals max, trailing zeros trimmed: 5.00 → '5', 2.40 → '2.4'. */
export function trimDiffMagnitude(n: number): string {
  return String(Number(n.toFixed(2)));
}
