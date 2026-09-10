import { describe, expect, it } from 'vitest';
import {
  MIN_VIEW_WINDOW,
  minSpanForPrecision,
  spanFromZoomPercent,
  zoomAt,
  zoomPercentFromSpan,
} from './viewState';

describe('viewState fp32 precision floor', () => {
  it('PR-VIEW-020: minSpanForPrecision keeps 1 fp32 ULP of the stored coords at ≤ 1 device px', () => {
    // Stored coords are `start - minTime` (magnitude ≈ fullSpan). At fullSpan = 2^29 the
    // fp32 ULP is 2^29·2^-23 = 2^6 = 64 time units. A 1440-dev-px track then needs
    // span ≥ 64 · 1440 / 1px = 92160 so a single ULP moves bounds by exactly 1 px.
    expect(minSpanForPrecision(2 ** 29, 1440)).toBeCloseTo(64 * 1440, 6);
    // Half the width doubles the zoom-in allowance (ULP still fits one px).
    expect(minSpanForPrecision(2 ** 29, 720)).toBeCloseTo(64 * 720, 6);
  });

  it('PR-VIEW-020: minSpanForPrecision never drops below the shared MIN_VIEW_WINDOW floor', () => {
    // Cursor-size / tiny spans: ULP·width shrinks below 1 → floor wins.
    expect(minSpanForPrecision(16, 1)).toBe(MIN_VIEW_WINDOW);
    expect(minSpanForPrecision(0, 100)).toBe(MIN_VIEW_WINDOW);
    // Degenerate width is clamped to 1, staying positive and finite.
    expect(minSpanForPrecision(2 ** 29, 0)).toBe(64);
  });

  it('PR-VIEW-021: slider 100 ↔ custom minSpan (zoom percent and zoomAt share the floor)', () => {
    const full = 2 ** 29;
    const min = minSpanForPrecision(full, 1440);
    expect(min).toBeGreaterThan(MIN_VIEW_WINDOW);
    expect(min).toBeLessThan(full);

    // 100% maps to the precision floor, not the old MIN_WINDOW.
    expect(spanFromZoomPercent(100, full, min)).toBe(min);
    expect(zoomPercentFromSpan(min, full, min)).toBe(100);

    // zoomAt cannot zoom past the precision floor either.
    const out = zoomAt(
      { startTime: 0, endTime: full, scrollY: 0 },
      10 ** 6,
      full / 2,
      { minTime: 0, maxTime: full },
      min,
    );
    expect(out.endTime - out.startTime).toBeGreaterThanOrEqual(min);

    // Default minSpan keeps the legacy MIN_WINDOW behavior (back-compat).
    expect(spanFromZoomPercent(100, full)).toBe(MIN_VIEW_WINDOW);
  });

  it('PR-VIEW-022: slider ↔ span round-trips with a custom minSpan', () => {
    const full = 1e9;
    const min = minSpanForPrecision(full, 1440);
    expect(min).toBeLessThan(full);

    const at50 = spanFromZoomPercent(50, full, min);
    expect(at50).toBeGreaterThan(min);
    expect(at50).toBeLessThan(full);
    expect(zoomPercentFromSpan(at50, full, min)).toBe(50);

    expect(spanFromZoomPercent(0, full, min)).toBe(full);
    expect(zoomPercentFromSpan(full, full, min)).toBe(0);
  });
});