import { ASIDE_WIDTH_DEFAULT } from '../../panelResize';

/** Sketch SVG baseline @ 360px aside (`320×220`, `visual/roofline.png`). */
export const SKETCH_SVG_W = 320;
export const SKETCH_SVG_H = 220;
export const SKETCH_PAD = { l: 34, r: 48, t: 20, b: 36 } as const;

/** StatsAside shell + card horizontal padding (see co-located specs). */
export const ROOFLINE_ASIDE_PAD_X = 12;
export const ROOFLINE_CARD_PAD_X = 8;

const scaleFromWidth = (w: number) => w / SKETCH_SVG_W;

/** Chart fills aside content well: fixed aside − shell pad − card pad. */
export const ROOFLINE_CHART_W =
  ASIDE_WIDTH_DEFAULT - ROOFLINE_ASIDE_PAD_X * 2 - ROOFLINE_CARD_PAD_X * 2;
const chartScale = scaleFromWidth(ROOFLINE_CHART_W);

export const ROOFLINE_CHART_H = Math.round(SKETCH_SVG_H * chartScale);

export const ROOFLINE_PAD = {
  l: Math.round(SKETCH_PAD.l * chartScale),
  r: Math.round(SKETCH_PAD.r * chartScale),
  t: Math.round(SKETCH_PAD.t * chartScale),
  b: Math.round(SKETCH_PAD.b * chartScale),
} as const;

export const ROOFLINE_MIX_TOP_INSET = Math.round(10 * chartScale);
export const ROOFLINE_Y_TICK_LABEL_DY = Math.round(3 * chartScale);
export const ROOFLINE_X_TICK_BELOW_PLOT = Math.round(12 * chartScale);
export const ROOFLINE_TOPS_GAP_ABOVE_PLOT = Math.round(9 * chartScale);
export const ROOFLINE_OPS_GAP_FROM_PLOT = Math.round(3 * chartScale);
