import { describe, expect, it } from 'vitest';
import {
  ASIDE_WIDTH_DEFAULT,
  ASIDE_WIDTH_MAX,
  ASIDE_WIDTH_MIN,
  clampPanelWidth,
  fitPanelWidths,
  GUTTER_WIDTH_DEFAULT,
  GUTTER_WIDTH_MAX,
  GUTTER_WIDTH_MIN,
  startHorizontalResize,
  TIMELINE_TRACK_MIN,
} from '../../src/ui/panelResize';

describe('panelResize', () => {
  it('clamps to min/max', () => {
    expect(clampPanelWidth(100, GUTTER_WIDTH_MIN, GUTTER_WIDTH_MAX)).toBe(GUTTER_WIDTH_MIN);
    expect(clampPanelWidth(999, GUTTER_WIDTH_MIN, GUTTER_WIDTH_MAX)).toBe(GUTTER_WIDTH_MAX);
    expect(clampPanelWidth(GUTTER_WIDTH_DEFAULT, GUTTER_WIDTH_MIN, GUTTER_WIDTH_MAX)).toBe(
      GUTTER_WIDTH_DEFAULT,
    );
  });

  it('aside width is fixed at v930 sketch proportion', () => {
    expect(ASIDE_WIDTH_DEFAULT).toBe(468);
    expect(ASIDE_WIDTH_MIN).toBe(ASIDE_WIDTH_DEFAULT);
    expect(ASIDE_WIDTH_MAX).toBe(ASIDE_WIDTH_DEFAULT);
  });

  it('startHorizontalResize applies direction for aside (left edge)', () => {
    const widths: number[] = [];
    const session = startHorizontalResize({
      startClientX: 1000,
      startWidth: ASIDE_WIDTH_DEFAULT,
      min: ASIDE_WIDTH_MIN,
      max: ASIDE_WIDTH_MAX,
      direction: -1,
      onChange: (w) => widths.push(w),
    });
    // Fixed aside: min === max, drag cannot change width
    expect(session.move(960)).toBe(ASIDE_WIDTH_DEFAULT);
    expect(widths.at(-1)).toBe(ASIDE_WIDTH_DEFAULT);
  });

  it('fitPanelWidths leaves wide layouts at preferred sizes', () => {
    const next = fitPanelWidths(1200, {
      asideVisible: true,
      preferredGutter: GUTTER_WIDTH_DEFAULT,
      preferredAside: ASIDE_WIDTH_DEFAULT,
    });
    expect(next).toEqual({
      gutterWidth: GUTTER_WIDTH_DEFAULT,
      asideWidth: ASIDE_WIDTH_DEFAULT,
    });
  });

  it('fitPanelWidths shrinks gutter only (aside stays sketch width)', () => {
    // ideal = 280 + 320 + 468 = 1068; host 900 → gutter hits min 180; aside stays 468
    const next = fitPanelWidths(900, {
      asideVisible: true,
      preferredGutter: GUTTER_WIDTH_DEFAULT,
      preferredAside: ASIDE_WIDTH_DEFAULT,
    });
    expect(next).toEqual({
      gutterWidth: GUTTER_WIDTH_MIN,
      asideWidth: ASIDE_WIDTH_DEFAULT,
    });
    expect(900 - next.asideWidth - next.gutterWidth).toBeLessThan(TIMELINE_TRACK_MIN);
  });

  it('fitPanelWidths hits gutter min when host is very narrow', () => {
    const next = fitPanelWidths(640, {
      asideVisible: true,
      preferredGutter: GUTTER_WIDTH_DEFAULT,
      preferredAside: ASIDE_WIDTH_DEFAULT,
    });
    expect(next).toEqual({
      gutterWidth: GUTTER_WIDTH_MIN,
      asideWidth: ASIDE_WIDTH_DEFAULT,
    });
  });

  it('fitPanelWidths shrinks only gutter when aside is hidden', () => {
    // ideal = 280 + 320 = 600; host 500 → gutter 180
    const next = fitPanelWidths(500, {
      asideVisible: false,
      preferredGutter: GUTTER_WIDTH_DEFAULT,
      preferredAside: ASIDE_WIDTH_DEFAULT,
    });
    expect(next).toEqual({
      gutterWidth: GUTTER_WIDTH_MIN,
      asideWidth: 0,
    });
  });

  it('fitPanelWidths restores gutter toward preferred when host grows', () => {
    const tight = fitPanelWidths(900, {
      asideVisible: true,
      preferredGutter: GUTTER_WIDTH_DEFAULT,
      preferredAside: ASIDE_WIDTH_DEFAULT,
    });
    expect(tight.asideWidth).toBe(ASIDE_WIDTH_DEFAULT);
    expect(tight.gutterWidth).toBeLessThan(GUTTER_WIDTH_DEFAULT);

    const wide = fitPanelWidths(1200, {
      asideVisible: true,
      preferredGutter: GUTTER_WIDTH_DEFAULT,
      preferredAside: ASIDE_WIDTH_DEFAULT,
    });
    expect(wide).toEqual({
      gutterWidth: GUTTER_WIDTH_DEFAULT,
      asideWidth: ASIDE_WIDTH_DEFAULT,
    });
  });

  it('fitPanelWidths ignores non-positive layout width', () => {
    for (const hostWidth of [0, -1, Number.NaN]) {
      expect(
        fitPanelWidths(hostWidth, {
          asideVisible: true,
          preferredGutter: GUTTER_WIDTH_DEFAULT,
          preferredAside: ASIDE_WIDTH_DEFAULT,
        }),
      ).toEqual({
        gutterWidth: GUTTER_WIDTH_DEFAULT,
        asideWidth: ASIDE_WIDTH_DEFAULT,
      });
    }
  });

  it('TIMELINE_TRACK_MIN is the default track floor', () => {
    expect(TIMELINE_TRACK_MIN).toBe(320);
  });
});
