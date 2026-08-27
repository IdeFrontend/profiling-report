import { describe, expect, it } from 'vitest';
import {
  AXIS_RULER_MIN_PIXEL_INTERVAL,
  buildAxisRulerTicks,
  calculateGridInterval,
  resolveAxisBaseOffset,
  resolveTimeUnitFromAxisDensity,
} from '../../src/domain/axisRuler';

describe('PR-AXIS: calculateGridInterval / buildAxisRulerTicks', () => {
  it('picks 1µs when ~1000 ns is needed per 100px', () => {
    // timePerPixel = 10 ns/px → min = 1000 ns → 1µs
    expect(calculateGridInterval(10)).toBe(1000);
    expect(AXIS_RULER_MIN_PIXEL_INTERVAL).toBe(100);
  });

  it('picks finer step when zoomed (smaller timePerPixel)', () => {
    expect(calculateGridInterval(1)).toBe(100); // 100 ns
    expect(calculateGridInterval(0.1)).toBe(10);
  });

  it('majors land on origin + k·interval and reflow with width', () => {
    const a = buildAxisRulerTicks({
      rangeStart: 0,
      rangeEnd: 10_000,
      origin: 0,
      timeScaleUnit: 'us',
      widthPx: 200,
    });
    const b = buildAxisRulerTicks({
      rangeStart: 0,
      rangeEnd: 10_000,
      origin: 0,
      timeScaleUnit: 'us',
      widthPx: 2000,
    });
    expect(b.interval).toBeLessThan(a.interval);
    expect(b.majors.length).toBeGreaterThan(a.majors.length);
    for (const m of a.majors) {
      expect(m.t % a.interval).toBe(0);
    }
  });

  it('resolveTimeUnitFromAxisDensity maps major step to scale unit', () => {
    // 10 ns/px → interval 1000 ns → us
    expect(resolveTimeUnitFromAxisDensity(8000, 800)).toBe('us');
    // very long span → coarser unit
    expect(resolveTimeUnitFromAxisDensity(2e12, 800)).toBe('s');
  });

  it('resolveAxisBaseOffset snaps coarse base one unit above tick scale', () => {
    const base = resolveAxisBaseOffset(236_256_145_000, 0, 'ns');
    expect(base).not.toBeNull();
    expect(base!.offsetNs).toBe(236_256_145_000);
    expect(base!.baseLabel).toContain('µs');
    expect(resolveAxisBaseOffset(500, 0, 'ns')).toBeNull();
  });

  it('buildAxisRulerTicks viewport base shortens deep tick labels', () => {
    const deep = buildAxisRulerTicks({
      rangeStart: 236_256_145_000,
      rangeEnd: 236_256_146_000,
      origin: 0,
      timeScaleUnit: 'ns',
      widthPx: 800,
      useViewportBase: true,
    });
    expect(deep.baseLabel).toBeTruthy();
    expect(deep.majors[0]?.label).not.toMatch(/236/);

    const overview = buildAxisRulerTicks({
      rangeStart: 0,
      rangeEnd: 10_000,
      origin: 0,
      timeScaleUnit: 'us',
      widthPx: 1000,
    });
    expect(overview.baseLabel).toBeNull();
  });
});
