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

  it('hits when cursor is on left measure border', () => {
    expect(
      cursorLabelOverlapsMeasureChrome({
        ...base,
        cursorXRatio: 100 / 400,
      }),
    ).toBe(true);
  });

  it('hits when cursor is on right measure border', () => {
    expect(
      cursorLabelOverlapsMeasureChrome({
        ...base,
        cursorXRatio: 300 / 400,
      }),
    ).toBe(true);
  });

  it('hits when cursor is at range midpoint (inline Δt)', () => {
    expect(
      cursorLabelOverlapsMeasureChrome({
        ...base,
        cursorXRatio: 0.5,
      }),
    ).toBe(true);
  });

  it('hits mid-shaft between Δt and edge bar inside the range', () => {
    expect(
      cursorLabelOverlapsMeasureChrome({
        ...base,
        measureLeftPct: 10,
        measureRightPct: 90,
        dtLabelW: 40,
        cursorLabelW: 40,
        cursorXRatio: 0.25, // inside [40, 360]
      }),
    ).toBe(true);
  });

  it('misses when cursor and label are clear of the selected range', () => {
    expect(
      cursorLabelOverlapsMeasureChrome({
        ...base,
        cursorXRatio: 0.05, // 20px; label [−16, 56], range [100, 300]
      }),
    ).toBe(false);
  });

  it('hits when playhead is outside but label crosses the range border', () => {
    // right bar at 300px; cursor at 320 (outside); 72px label → [284, 356] crosses 300.
    expect(
      cursorLabelOverlapsMeasureChrome({
        ...base,
        cursorXRatio: 320 / 400,
      }),
    ).toBe(true);
  });

  it('hits outside-right Δt past the right bar', () => {
    expect(
      cursorLabelOverlapsMeasureChrome({
        ...base,
        measureLeftPct: 40,
        measureRightPct: 50,
        dtPlacement: { mode: 'outside', side: 'right' },
        dtLabelW: 60,
        cursorXRatio: (200 + 4 + 30) / 400,
      }),
    ).toBe(true);
  });

  it('hits outside-left Δt past the left bar', () => {
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
