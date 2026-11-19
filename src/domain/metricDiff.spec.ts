import { describe, expect, it } from 'vitest';
import { metricDiff, summaryDiffs, utilizationPercent } from './metricDiff';

describe('metricDiff', () => {
  it('negative delta (current above baseline) tones increase', () => {
    expect(metricDiff(90, 86)).toEqual({ tone: 'increase', delta: -4, magnitude: 4 });
  });

  it('positive delta (current below baseline) tones decrease', () => {
    expect(metricDiff(86, 90)).toEqual({ tone: 'decrease', delta: 4, magnitude: 4 });
  });

  it('nulls on missing, non-finite, or zero difference', () => {
    expect(metricDiff(undefined, 5)).toBeNull();
    expect(metricDiff(5, undefined)).toBeNull();
    expect(metricDiff(Number.NaN, 5)).toBeNull();
    expect(metricDiff(5, Number.POSITIVE_INFINITY)).toBeNull();
    expect(metricDiff(Number.POSITIVE_INFINITY, 5)).toBeNull();
    expect(metricDiff(5, 5)).toBeNull();
    expect(metricDiff(0, 0)).toBeNull();
  });

  it('nulls an overflowing delta (finite inputs, infinite difference)', () => {
    expect(metricDiff(-1e308, 1e308)).toBeNull();
  });

  it('suppresses a delta that displays as zero (rounding and float artefacts)', () => {
    // The label rounds to 2 decimals: a 1e-4 delta would print "0".
    expect(metricDiff(0.0001, 0.0002)).toBeNull();
    // A delta that only exists below the display precision: -1e-13 toFixed(2)
    // is "0.00", and the old `delta === 0` guard would have kept the diff —
    // this case fails if the guard reverts.
    expect(metricDiff(1e-13, 0)).toBeNull();
  });
});

describe('utilizationPercent', () => {
  it('converts a ratio to percentage points', () => {
    expect(utilizationPercent(12, 100)).toBe(12);
    expect(utilizationPercent(0.5, 1)).toBe(50);
  });

  it('nulls when the peak is unusable', () => {
    expect(utilizationPercent(12, 0)).toBeNull();
    expect(utilizationPercent(12, -1)).toBeNull();
    expect(utilizationPercent(12, undefined)).toBeNull();
    expect(utilizationPercent(undefined, 100)).toBeNull();
    expect(utilizationPercent(Number.NaN, 100)).toBeNull();
    expect(utilizationPercent(12, Number.POSITIVE_INFINITY)).toBeNull();
    expect(utilizationPercent(Number.POSITIVE_INFINITY, 100)).toBeNull();
    expect(utilizationPercent(Number.NEGATIVE_INFINITY, 100)).toBeNull();
  });

  it('passes negative measured values through (the card displays a negative balance)', () => {
    // The producer's `1 − σ/μ` balance is a real displayed number: the bar
    // clamps to 0, the tooltip keeps the value — the diff must see it too.
    expect(utilizationPercent(-0.42, 1)).toBe(-42);
    expect(utilizationPercent(-0.035, 1)).toBeCloseTo(-3.5);
  });

  it('nulls a ratio that overflows to Infinity', () => {
    expect(utilizationPercent(1e308, 5e-324)).toBeNull();
  });
});

describe('summaryDiffs', () => {
  const current = {
    taskDurationUs: 1000,
    parallelUtilization: 0.9,
    parallelBalance: 0.82,
    compute: {
      aic: { measuredTflops: 50, peakTflops: 100 },
      aiv: { measuredTflops: 30, peakTflops: 100 },
    },
    bandwidth: {
      read: { measuredGBs: 1200, peakGBs: 1600 },
      write: { measuredGBs: 800, peakGBs: 1600 },
    },
  };

  it('diffs every metric in the card units (duration raw µs, others percentage points)', () => {
    const diffs = summaryDiffs(current, {
      taskDurationUs: 1200,
      parallelUtilization: 0.86,
      parallelBalance: 0.9,
      compute: {
        aic: { measuredTflops: 40, peakTflops: 100 },
        aiv: { measuredTflops: 40, peakTflops: 100 },
      },
      bandwidth: {
        read: { measuredGBs: 900, peakGBs: 1600 },
        write: { measuredGBs: 1000, peakGBs: 1600 },
      },
    });
    // baseline − current; positive → decrease (value went down), negative → increase (value went up).
    expect(diffs.taskDurationUs).toEqual({ tone: 'decrease', delta: 200, magnitude: 200 });
    expect(diffs.parallelUtilization).toEqual({ tone: 'increase', delta: -4, magnitude: 4 });
    expect(diffs.parallelBalance).toEqual({ tone: 'decrease', delta: 8, magnitude: 8 });
    expect(diffs.computeAic).toEqual({ tone: 'increase', delta: -10, magnitude: 10 });
    expect(diffs.computeAiv).toEqual({ tone: 'decrease', delta: 10, magnitude: 10 });
    expect(diffs.bandwidthRead).toEqual({ tone: 'increase', delta: -18.75, magnitude: 18.75 });
    expect(diffs.bandwidthWrite).toEqual({ tone: 'decrease', delta: 12.5, magnitude: 12.5 });
  });

  it('compute/bandwidth deltas are utilization points — peaks may differ per side', () => {
    // Current 90/100 (90% of a 100-peak) vs baseline 50/50 (100% of a 50-peak):
    // the RAW throughput rose, but utilization fell 100 → 90, so the tone is
    // 'decrease' with a 10-point delta — not a raw-TFLOPS comparison.
    const diffs = summaryDiffs(
      { compute: { aic: { measuredTflops: 90, peakTflops: 100 } } },
      { compute: { aic: { measuredTflops: 50, peakTflops: 50 } } },
    );
    expect(diffs.computeAic).toEqual({ tone: 'decrease', delta: 10, magnitude: 10 });
  });

  it('nulls each diff independently when a side is missing', () => {
    const diffs = summaryDiffs(current, {
      taskDurationUs: 1200,
      parallelUtilization: 0.5,
      bandwidth: { read: { measuredGBs: 800, peakGBs: 1600 } },
    });
    expect(diffs.taskDurationUs).not.toBeNull();
    expect(diffs.parallelUtilization).not.toBeNull();
    expect(diffs.parallelBalance).toBeNull();
    expect(diffs.computeAic).toBeNull();
    expect(diffs.computeAiv).toBeNull();
    expect(diffs.bandwidthRead).not.toBeNull();
    expect(diffs.bandwidthWrite).toBeNull();
  });

  it('a zero magnitude suppresses the badge', () => {
    const diffs = summaryDiffs(current, { ...current });
    // All SEVEN keys, not just the shallow-spread ones: the spread aliases
    // current.compute / current.bandwidth, so each key needs its own check.
    expect(diffs.taskDurationUs).toBeNull();
    expect(diffs.parallelUtilization).toBeNull();
    expect(diffs.parallelBalance).toBeNull();
    expect(diffs.computeAic).toBeNull();
    expect(diffs.computeAiv).toBeNull();
    expect(diffs.bandwidthRead).toBeNull();
    expect(diffs.bandwidthWrite).toBeNull();
  });
});
