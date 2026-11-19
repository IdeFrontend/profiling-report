/**
 * Flip / clamp a `position: fixed` hover tip inside the viewport (iframe / report panel).
 *
 * Prefer below-right of the pointer (same +12px gap as EventTooltip / OverviewCharts).
 * If that box would crop past the bottom or right edge, flip and anchor the **near** edge
 * at `pointer ± offset` via CSS `right` / `bottom` — so the gap stays exactly `offset`
 * even when `tipW`/`tipH` are estimates (a left-edge `left = x - offset - tipW` placement
 * overshoots whenever the estimate is larger than the painted tip).
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

/**
 * CSS fixed insets. Flipped axes use `right`/`bottom` (near-edge anchor); preferred
 * axes use `left`/`top`. Unused sides are `null` — callers must clear them (`auto`).
 */
export type PlaceFixedTipResult = {
  left: number | null;
  right: number | null;
  top: number | null;
  bottom: number | null;
};

export function placeFixedTip(input: PlaceFixedTipInput): PlaceFixedTipResult {
  const offset = input.offset ?? FIXED_TIP_OFFSET_PX;
  const pad = input.pad ?? FIXED_TIP_PAD_PX;
  const tipW = Math.max(0, input.tipW);
  const tipH = Math.max(0, input.tipH);
  const vw = Math.max(0, input.viewportW);
  const vh = Math.max(0, input.viewportH);

  let left: number | null = input.x + offset;
  let right: number | null = null;
  let top: number | null = input.y + offset;
  let bottom: number | null = null;

  // Flip left of the pointer when the preferred right placement would crop.
  // Anchor the tip's RIGHT edge at x - offset so the gap equals `offset` regardless of tipW.
  if (left + tipW > vw - pad) {
    const tipRight = input.x - offset;
    if (tipRight - tipW < pad) {
      // Tip wider than room to the left of the anchor — pin the left edge.
      left = pad;
      right = null;
    } else {
      right = Math.max(pad, vw - tipRight);
      left = null;
    }
  }

  // Flip above the pointer when the preferred below placement would crop.
  // Anchor the tip's BOTTOM edge at y - offset (symmetric with horizontal flip).
  if (top + tipH > vh - pad) {
    const tipBottom = input.y - offset;
    if (tipBottom - tipH < pad) {
      top = pad;
      bottom = null;
    } else {
      bottom = Math.max(pad, vh - tipBottom);
      top = null;
    }
  }

  // Final clamp on preferred (non-flipped) axes: flip alone can still overflow
  // on a tiny viewport or when the pointer sits in the pad strip.
  if (left != null) {
    const maxLeft = Math.max(pad, vw - tipW - pad);
    left = Math.min(Math.max(left, pad), maxLeft);
  }
  if (top != null) {
    const maxTop = Math.max(pad, vh - tipH - pad);
    top = Math.min(Math.max(top, pad), maxTop);
  }

  return { left, right, top, bottom };
}
