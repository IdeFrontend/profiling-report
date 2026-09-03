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

  it('aside opens at 480px and clamps 280–720', () => {
    expect(ASIDE_WIDTH_DEFAULT).toBe(480);
    expect(ASIDE_WIDTH_MIN).toBe(280);
    expect(ASIDE_WIDTH_MAX).toBe(720);
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
    // Pointer moves left → aside grows
    expect(session.move(960)).toBe(ASIDE_WIDTH_DEFAULT + 40);
    expect(widths.at(-1)).toBe(ASIDE_WIDTH_DEFAULT + 40);
  });

  it('fitPanelWidths leaves wide layouts at preferred sizes', () => {
    const next = fitPanelWidths(1400, {
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
    // ideal = 280 + 320 + 480 = 1080; host 900 → deficit 180 → aside 300, gutter 280
    const next = fitPanelWidths(900, {
      asideVisible: true,
      preferredGutter: GUTTER_WIDTH_DEFAULT,
      preferredAside: ASIDE_WIDTH_DEFAULT,
    });
    expect(next).toEqual({
      gutterWidth: GUTTER_WIDTH_DEFAULT,
      asideWidth: ASIDE_WIDTH_DEFAULT - 180,
    });
    expect(next.asideWidth + next.gutterWidth + TIMELINE_TRACK_MIN).toBe(900);
  });

  it('fitPanelWidths hits both mins when host is very narrow', () => {
    // ideal 1080; host 640 → aside to 280 (−200), then gutter to 180 (−100); still short
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
      asideWidth: 0,
    });
  });

  it('fitPanelWidths restores toward preferred when host grows', () => {
    const tight = fitPanelWidths(900, {
      asideVisible: true,
      preferredGutter: GUTTER_WIDTH_DEFAULT,
      preferredAside: ASIDE_WIDTH_DEFAULT,
    });
    expect(tight.asideWidth).toBeLessThan(ASIDE_WIDTH_DEFAULT);

    const wide = fitPanelWidths(1400, {
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
