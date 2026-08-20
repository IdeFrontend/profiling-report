/** Cursor bubble min-width in CursorTimestamp. */
export const CURSOR_LABEL_MIN_WIDTH_PX = 72;
/** Expand bar / Δt hit boxes to reduce edge flicker. */
export const MEASURE_CHROME_HIT_PAD_PX = 4;
/** Gap between measure bar and outside Δt pill. */
export const MEASURE_OUTSIDE_LABEL_GAP_PX = 4;

export type MeasureDtPlacement =
  | { mode: 'inline' }
  | { mode: 'outside' | 'shaft'; side: 'left' | 'right' };

export type CursorMeasureOverlapInput = {
  axisW: number;
  cursorXRatio: number;
  /** Full cursor label width (already max'd with min-width if desired). */
  cursorLabelW: number;
  measureLeftPct: number;
  measureRightPct: number;
  dtLabelW: number;
  dtPlacement: MeasureDtPlacement;
  padPx?: number;
};

function intervalsOverlap(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 && b0 < a1;
}

/** Estimate cursor / Δt pill width from glyph count (matches TimelineView estimate). */
export function estimateAxisLabelWidth(label: string, minWidth = 0): number {
  // padding 1+8*2 ≈ 17; ~6.5px tabular glyph at 11px.
  return Math.max(minWidth, 17 + Math.ceil(label.length * 6.5));
}

/**
 * True when the cursor timestamp pill would horizontally intersect a measure
 * border or the Δt duration label on the viewport time axis.
 */
export function cursorLabelOverlapsMeasureChrome(input: CursorMeasureOverlapInput): boolean {
  const {
    axisW,
    cursorXRatio,
    cursorLabelW,
    measureLeftPct,
    measureRightPct,
    dtLabelW,
    dtPlacement,
    padPx = MEASURE_CHROME_HIT_PAD_PX,
  } = input;
  if (!(axisW > 0) || !(cursorLabelW > 0) || !(dtLabelW > 0)) return false;

  const cursorX = cursorXRatio * axisW;
  const half = cursorLabelW / 2;
  const c0 = cursorX - half;
  const c1 = cursorX + half;

  const leftPx = (measureLeftPct / 100) * axisW;
  const rightPx = (measureRightPct / 100) * axisW;

  if (intervalsOverlap(c0, c1, leftPx - padPx, leftPx + padPx)) return true;
  if (intervalsOverlap(c0, c1, rightPx - padPx, rightPx + padPx)) return true;

  let dt0: number;
  let dt1: number;
  if (dtPlacement.mode === 'inline') {
    const mid = (leftPx + rightPx) / 2;
    dt0 = mid - dtLabelW / 2;
    dt1 = mid + dtLabelW / 2;
  } else if (dtPlacement.side === 'right') {
    dt0 = rightPx + MEASURE_OUTSIDE_LABEL_GAP_PX;
    dt1 = dt0 + dtLabelW;
  } else {
    dt1 = leftPx - MEASURE_OUTSIDE_LABEL_GAP_PX;
    dt0 = dt1 - dtLabelW;
  }

  return intervalsOverlap(c0, c1, dt0 - padPx, dt1 + padPx);
}
