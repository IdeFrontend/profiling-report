import { describe, expect, it } from 'vitest';
import {
  AXIS_RULER_MIN_PIXEL_INTERVAL,
  buildAxisRulerTicks,
  calculateGridInterval,
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
      timeUnit: 'us',
      widthPx: 200,
    });
    const b = buildAxisRulerTicks({
      rangeStart: 0,
      rangeEnd: 10_000,
      origin: 0,
      timeUnit: 'us',
      widthPx: 2000,
    });
    expect(b.interval).toBeLessThan(a.interval);
    expect(b.majors.length).toBeGreaterThan(a.majors.length);
    for (const m of a.majors) {
      expect(m.t % a.interval).toBe(0);
    }
  });
});
