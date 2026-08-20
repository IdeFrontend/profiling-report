import { describe, expect, it } from 'vitest';
import {
  CURSOR_LABEL_MIN_WIDTH_PX,
  cursorLabelOverlapsMeasureChrome,
  estimateAxisLabelWidth,
} from './cursorMeasureOverlap';

describe('cursorMeasureOverlap', () => {
  const base = {
    axisW: 400,
    cursorLabelW: CURSOR_LABEL_MIN_WIDTH_PX,
    measureLeftPct: 25,
    measureRightPct: 75,
    dtLabelW: 80,
    dtPlacement: { mode: 'inline' as const },
  };

  it('returns false when axisW is 0', () => {
    expect(
      cursorLabelOverlapsMeasureChrome({
        ...base,
        axisW: 0,
        cursorXRatio: 0.5,
      }),
    ).toBe(false);
  });

  it('hits left measure border', () => {
    // left at 100px; cursor centered on bar with 72px label.
    expect(
      cursorLabelOverlapsMeasureChrome({
        ...base,
        cursorXRatio: 100 / 400,
      }),
    ).toBe(true);
  });

  it('hits right measure border', () => {
    expect(
      cursorLabelOverlapsMeasureChrome({
        ...base,
        cursorXRatio: 300 / 400,
      }),
    ).toBe(true);
  });

  it('hits inline Δt at range midpoint', () => {
    expect(
      cursorLabelOverlapsMeasureChrome({
        ...base,
        cursorXRatio: 0.5,
      }),
    ).toBe(true);
  });

  it('misses mid-shaft away from borders and inline Δt', () => {
    // Midway between left bar (100) and Δt center (200): ~150px.
    // Cursor half-width 36 → [114, 186]; Δt [160, 240] with pad still overlaps...
    // Use a wide range and narrow dt so mid-left shaft is clear.
    expect(
      cursorLabelOverlapsMeasureChrome({
        ...base,
        measureLeftPct: 10,
        measureRightPct: 90,
        dtLabelW: 40,
        cursorLabelW: 40,
        cursorXRatio: 0.25, // 100px; left bar at 40, mid at 200, Δt [180,220]
      }),
    ).toBe(false);
  });

  it('hits outside-right Δt', () => {
    expect(
      cursorLabelOverlapsMeasureChrome({
        ...base,
        measureLeftPct: 40,
        measureRightPct: 50,
        dtPlacement: { mode: 'outside', side: 'right' },
        dtLabelW: 60,
        cursorXRatio: (200 + 4 + 30) / 400, // mid of outside label
      }),
    ).toBe(true);
  });

  it('hits outside-left Δt', () => {
    expect(
      cursorLabelOverlapsMeasureChrome({
        ...base,
        measureLeftPct: 50,
        measureRightPct: 60,
        dtPlacement: { mode: 'shaft', side: 'left' },
        dtLabelW: 60,
        cursorXRatio: (200 - 4 - 30) / 400,
      }),
    ).toBe(true);
  });

  it('estimateAxisLabelWidth respects min width', () => {
    expect(estimateAxisLabelWidth('1', CURSOR_LABEL_MIN_WIDTH_PX)).toBe(CURSOR_LABEL_MIN_WIDTH_PX);
    expect(estimateAxisLabelWidth('00:12.345', CURSOR_LABEL_MIN_WIDTH_PX)).toBeGreaterThanOrEqual(
      CURSOR_LABEL_MIN_WIDTH_PX,
    );
  });
});
