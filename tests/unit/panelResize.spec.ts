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
    // Drag 40px left → wider aside
    expect(session.move(960)).toBe(ASIDE_WIDTH_DEFAULT + 40);
    expect(widths.at(-1)).toBe(ASIDE_WIDTH_DEFAULT + 40);
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

  it('fitPanelWidths shrinks aside first, then gutter', () => {
    // ideal = 280 + 320 + 360 = 960; host 900 → deficit 60 → aside 300, gutter 280
    const next = fitPanelWidths(900, {
      asideVisible: true,
      preferredGutter: GUTTER_WIDTH_DEFAULT,
      preferredAside: ASIDE_WIDTH_DEFAULT,
    });
    expect(next).toEqual({
      gutterWidth: GUTTER_WIDTH_DEFAULT,
      asideWidth: ASIDE_WIDTH_DEFAULT - 60,
    });
    expect(900 - next.asideWidth - next.gutterWidth).toBe(TIMELINE_TRACK_MIN);
  });

  it('fitPanelWidths hits mins when host is very narrow', () => {
    // deficit beyond aside+gutter shrink room → both floors
    const next = fitPanelWidths(640, {
      asideVisible: true,
      preferredGutter: GUTTER_WIDTH_DEFAULT,
      preferredAside: ASIDE_WIDTH_DEFAULT,
    });
    expect(next).toEqual({
      gutterWidth: GUTTER_WIDTH_MIN,
      asideWidth: ASIDE_WIDTH_MIN,
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
      asideWidth: ASIDE_WIDTH_DEFAULT,
    });
  });

  it('fitPanelWidths restores toward preferred when host grows', () => {
    const tight = fitPanelWidths(900, {
      asideVisible: true,
      preferredGutter: GUTTER_WIDTH_DEFAULT,
      preferredAside: ASIDE_WIDTH_DEFAULT,
    });
    expect(tight.asideWidth).toBeLessThan(ASIDE_WIDTH_DEFAULT);

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
