/**
 * Flip / clamp a `position: fixed` hover tip inside the viewport (iframe / report panel).
 *
 * Prefer below-right of the pointer (same +12px gap as EventTooltip / OverviewCharts).
 * If that box would crop past the bottom or right edge, flip to the other side of the
 * pointer; then clamp so a tip larger than the remaining room still stays fully visible.
 *
 * Same idea as ContextMenu `place()` and StatsAside / SourceMetricsTable tip flips —
 * extracted so CounterHoverTip (and siblings) share one tested path instead of a second
 * ad-hoc system.
 */

export const FIXED_TIP_OFFSET_PX = 12;
export const FIXED_TIP_PAD_PX = 4;

/** CounterHoverTip chrome estimate: min-width 120 + pad; two 12px/1.45 lines. */
export const COUNTER_HOVER_TIP_EST_W = 180;
/** Header + Time row + util row + optional Using row (+ padding). */
export const COUNTER_HOVER_TIP_EST_H = 90;

export type PlaceFixedTipInput = {
  x: number;
  y: number;
  tipW: number;
  tipH: number;
  viewportW: number;
  viewportH: number;
  offset?: number;
  pad?: number;
};

export type PlaceFixedTipResult = { left: number; top: number };

export function placeFixedTip(input: PlaceFixedTipInput): PlaceFixedTipResult {
  const offset = input.offset ?? FIXED_TIP_OFFSET_PX;
  const pad = input.pad ?? FIXED_TIP_PAD_PX;
  const tipW = Math.max(0, input.tipW);
  const tipH = Math.max(0, input.tipH);
  const vw = Math.max(0, input.viewportW);
  const vh = Math.max(0, input.viewportH);

  let left = input.x + offset;
  let top = input.y + offset;

  // Flip left of the pointer when the preferred right placement would crop.
  if (left + tipW > vw - pad) {
    left = input.x - offset - tipW;
  }
  // Flip above the pointer when the preferred below placement would crop.
  if (top + tipH > vh - pad) {
    top = input.y - offset - tipH;
  }

  // Final clamp: flip alone can still overflow on a tiny viewport or huge tip.
  const maxLeft = Math.max(pad, vw - tipW - pad);
  const maxTop = Math.max(pad, vh - tipH - pad);
  left = Math.min(Math.max(left, pad), maxLeft);
  top = Math.min(Math.max(top, pad), maxTop);

  return { left, top };
}
