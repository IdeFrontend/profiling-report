import { describe, expect, it } from 'vitest';
import {
  ASIDE_WIDTH_DEFAULT,
  ASIDE_WIDTH_MAX,
  ASIDE_WIDTH_MIN,
  clampPanelWidth,
  fitPanelsForTrackMin,
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

  it('fitPanelsForTrackMin leaves wide layouts unchanged', () => {
    const next = fitPanelsForTrackMin({
      layoutWidth: 1200,
      showAside: true,
      gutterWidth: GUTTER_WIDTH_DEFAULT,
      asideWidth: ASIDE_WIDTH_DEFAULT,
    });
    expect(next).toEqual({
      gutterWidth: GUTTER_WIDTH_DEFAULT,
      asideWidth: ASIDE_WIDTH_DEFAULT,
    });
  });

  it('fitPanelsForTrackMin shrinks gutter and aside when track would be under min', () => {
    // 640 - 360 - 280 = 0 < 200
    const next = fitPanelsForTrackMin({
      layoutWidth: 640,
      showAside: true,
      gutterWidth: GUTTER_WIDTH_DEFAULT,
      asideWidth: ASIDE_WIDTH_DEFAULT,
    });
    expect(next).toEqual({
      gutterWidth: GUTTER_WIDTH_MIN,
      asideWidth: ASIDE_WIDTH_MIN,
    });
  });

  it('fitPanelsForTrackMin shrinks only gutter when aside is hidden', () => {
    // 400 - 280 = 120 < 200
    const next = fitPanelsForTrackMin({
      layoutWidth: 400,
      showAside: false,
      gutterWidth: GUTTER_WIDTH_DEFAULT,
      asideWidth: ASIDE_WIDTH_DEFAULT,
    });
    expect(next).toEqual({
      gutterWidth: GUTTER_WIDTH_MIN,
      asideWidth: ASIDE_WIDTH_DEFAULT,
    });
  });

  it('fitPanelsForTrackMin ignores non-positive layout width', () => {
    for (const layoutWidth of [0, -1, Number.NaN]) {
      expect(
        fitPanelsForTrackMin({
          layoutWidth,
          showAside: true,
          gutterWidth: GUTTER_WIDTH_DEFAULT,
          asideWidth: ASIDE_WIDTH_DEFAULT,
        }),
      ).toEqual({
        gutterWidth: GUTTER_WIDTH_DEFAULT,
        asideWidth: ASIDE_WIDTH_DEFAULT,
      });
    }
  });

  it('TIMELINE_TRACK_MIN is the default track floor', () => {
    expect(TIMELINE_TRACK_MIN).toBe(200);
  });
});
