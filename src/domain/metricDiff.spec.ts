import { describe, expect, it } from 'vitest';
import { metricDiff, summaryDiffs, utilizationPercent } from './metricDiff';

describe('metricDiff', () => {
  it('negative delta (current above baseline) tones increase (red up)', () => {
    expect(metricDiff(90, 86)).toEqual({ tone: 'increase', delta: -4, magnitude: 4 });
  });

  it('positive delta (current below baseline) tones decrease (green down)', () => {
    expect(metricDiff(86, 90)).toEqual({ tone: 'decrease', delta: 4, magnitude: 4 });
  });

  it('nulls on missing, non-finite, or zero difference', () => {
    expect(metricDiff(undefined, 5)).toBeNull();
    expect(metricDiff(5, undefined)).toBeNull();
    expect(metricDiff(Number.NaN, 5)).toBeNull();
    expect(metricDiff(5, Number.POSITIVE_INFINITY)).toBeNull();
    expect(metricDiff(5, 5)).toBeNull();
    expect(metricDiff(0, 0)).toBeNull();
  });

  it('never produces -0', () => {
    const diff = metricDiff(-0, 0);
    expect(diff).toBeNull();
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
    // baseline − current; positive → green down (decrease), negative → red up (increase).
    expect(diffs.taskDurationUs).toEqual({ tone: 'decrease', delta: 200, magnitude: 200 });
    expect(diffs.parallelUtilization).toEqual({ tone: 'increase', delta: -4, magnitude: 4 });
    expect(diffs.parallelBalance).toEqual({ tone: 'decrease', delta: 8, magnitude: 8 });
    expect(diffs.computeAic).toEqual({ tone: 'increase', delta: -10, magnitude: 10 });
    expect(diffs.computeAiv).toEqual({ tone: 'decrease', delta: 10, magnitude: 10 });
    expect(diffs.bandwidthRead).toEqual({ tone: 'increase', delta: -18.75, magnitude: 18.75 });
    expect(diffs.bandwidthWrite).toEqual({ tone: 'decrease', delta: 12.5, magnitude: 12.5 });
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
    expect(diffs.taskDurationUs).toBeNull();
    expect(diffs.parallelUtilization).toBeNull();
    expect(diffs.computeAic).toBeNull();
  });
});
