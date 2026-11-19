import { describe, expect, it } from 'vitest';
import { LEGEND_OCC_MIN_PX, mergeOccupancyBands } from './legendOccupancy';

describe('mergeOccupancyBands', () => {
  it('expands a single intensity to ≥3px (1.5% on a 200px track)', () => {
    const bands = mergeOccupancyBands([0.5], 200);
    expect(bands).toHaveLength(1);
    // 3/200 = 1.5% centered on 50 → [49.25, 50.75]
    expect(bands[0]!.widthPct).toBeCloseTo((LEGEND_OCC_MIN_PX / 200) * 100, 5);
    expect(bands[0]!.leftPct + bands[0]!.widthPct / 2).toBeCloseTo(50, 5);
  });

  it('keeps two well-separated intensities as two bands', () => {
    const bands = mergeOccupancyBands([0, 1], 200);
    expect(bands).toHaveLength(2);
    expect(bands[0]!.leftPct).toBe(0);
    expect(bands[0]!.widthPct).toBeCloseTo(1.5, 5);
    expect(bands[1]!.leftPct + bands[1]!.widthPct).toBeCloseTo(100, 5);
    expect(bands[1]!.widthPct).toBeCloseTo(1.5, 5);
  });

  it('merges overlapping expansions', () => {
    // minPct = 1.5; 0.50 and 0.505 are 0.5% apart → merge
    const bands = mergeOccupancyBands([0.5, 0.505], 200);
    expect(bands).toHaveLength(1);
    expect(bands[0]!.widthPct).toBeGreaterThan(1.5);
  });

  it('returns empty when track width is zero', () => {
    expect(mergeOccupancyBands([0.5], 0)).toEqual([]);
  });
});
