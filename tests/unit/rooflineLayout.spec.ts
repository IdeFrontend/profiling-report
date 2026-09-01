import { describe, expect, it } from 'vitest';
import { ASIDE_WIDTH_DEFAULT } from '../../src/ui/panelResize';
import {
  ROOFLINE_ASIDE_PAD_X,
  ROOFLINE_CARD_PAD_X,
  ROOFLINE_CHART_H,
  ROOFLINE_CHART_W,
  ROOFLINE_PAD,
  SKETCH_SVG_W,
} from '../../src/ui/StatsAside/RooflinePanel/rooflineLayout';

describe('rooflineLayout', () => {
  it('derives chart width from fixed aside content well', () => {
    expect(ASIDE_WIDTH_DEFAULT).toBe(468);
    expect(ROOFLINE_CHART_W).toBe(
      ASIDE_WIDTH_DEFAULT - ROOFLINE_ASIDE_PAD_X * 2 - ROOFLINE_CARD_PAD_X * 2,
    );
    expect(ROOFLINE_CHART_W).toBe(428);
  });

  it('scales sketch baseline PAD and height proportionally', () => {
    const scale = ROOFLINE_CHART_W / SKETCH_SVG_W;
    expect(ROOFLINE_CHART_H).toBe(Math.round(220 * scale));
    expect(ROOFLINE_PAD.l).toBe(Math.round(34 * scale));
    expect(ROOFLINE_PAD.r).toBe(Math.round(48 * scale));
  });
});
