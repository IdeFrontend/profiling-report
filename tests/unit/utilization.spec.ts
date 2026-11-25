import { describe, expect, it } from 'vitest';
import {
  computeThreadUtilization,
  counterUtilizationFraction,
  coveredLength,
  isRatioUtilizationKey,
  timeWeightedCounterMean,
} from '../../src/domain/utilization';
import type { SwimThread } from '../../src/domain/types';

describe('PR-UTIL: thread utilization', () => {
  it('PR-UTIL-001: merges overlapping intervals instead of double-counting', () => {
    expect(
      coveredLength([
        { start: 0, end: 100 },
        { start: 50, end: 150 },
      ]),
    ).toBe(150);

    const thread: SwimThread = {
      id: 't',
      name: 'lane',
      events: [
        { id: 'a', name: 'long', startTime: 0, duration: 100 },
        { id: 'b', name: 'nested', startTime: 10, duration: 20 },
      ],
    };
    expect(computeThreadUtilization(thread, 0, 100)).toBe(1);
  });

  it('PR-UTIL-002: clamps to the visible window', () => {
    const thread: SwimThread = {
      id: 't',
      name: 'lane',
      events: [{ id: 'a', name: 'ev', startTime: -50, duration: 100 }],
    };
    expect(computeThreadUtilization(thread, 0, 100)).toBe(0.5);
  });

  it('PR-UTIL-003: zero-duration ticks contribute no coverage', () => {
    const thread: SwimThread = {
      id: 't',
      name: 'ICACHE_READ',
      events: [
        { id: 'hit', name: 'ICACHE_HIT', startTime: 10, duration: 0 },
        { id: 'bar', name: 'work', startTime: 20, duration: 40 },
      ],
    };
    expect(computeThreadUtilization(thread, 0, 100)).toBe(0.4);
  });

  it('PR-UTIL-004: ratio key heuristic excludes queue/bytes', () => {
    expect(isRatioUtilizationKey('Utilization (%)')).toBe(true);
    expect(isRatioUtilizationKey('memory_utilization')).toBe(true);
    expect(isRatioUtilizationKey('利用率')).toBe(true);
    expect(isRatioUtilizationKey('exec_queue_utilization')).toBe(false);
    expect(isRatioUtilizationKey('Exec Queue Utilization')).toBe(false);
    expect(isRatioUtilizationKey('issue_queue_utilization')).toBe(false);
    expect(isRatioUtilizationKey('Using Bytes (KB)')).toBe(false);
  });

  it('PR-UTIL-005: time-weighted mean holds step-after across gaps', () => {
    // [0,50): 10 — [50,100]: 90 → mean 50 over [0,100]
    expect(
      timeWeightedCounterMean(
        [
          { t: 0, v: 10 },
          { t: 50, v: 90 },
        ],
        0,
        100,
      ),
    ).toBe(50);
    // Sample before window still holds into it
    expect(
      timeWeightedCounterMean([{ t: -10, v: 40 }], 0, 100),
    ).toBe(40);
    expect(timeWeightedCounterMean([], 0, 100)).toBeUndefined();
  });

  it('PR-UTIL-006: counter util fraction scales by yMax ≤1 vs already-percent', () => {
    const alreadyPct: SwimThread = {
      id: 'pct',
      name: 'Utilization (%)',
      events: [],
      counter: {
        yMax: 40,
        points: [
          { t: 0, v: 20 },
          { t: 50, v: 40 },
        ],
      },
    };
    // mean 30% → 0.30
    expect(counterUtilizationFraction(alreadyPct, 0, 100)).toBeCloseTo(0.3);

    const fraction: SwimThread = {
      id: 'frac',
      name: 'memory_utilization',
      events: [],
      counter: {
        yMax: 0.5,
        points: [
          { t: 0, v: 0.2 },
          { t: 50, v: 0.4 },
        ],
      },
    };
    // mean 0.3 → ×100 → 30% → 0.30
    expect(counterUtilizationFraction(fraction, 0, 100)).toBeCloseTo(0.3);

    const queue: SwimThread = {
      id: 'q',
      name: 'exec_queue_utilization',
      events: [],
      counter: { yMax: 10, points: [{ t: 0, v: 4 }] },
    };
    expect(counterUtilizationFraction(queue, 0, 100)).toBeUndefined();
  });
});
