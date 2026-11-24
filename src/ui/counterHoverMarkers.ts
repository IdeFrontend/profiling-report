/**
 * Shared CounterTrack / OverviewCharts hover marker geometry + chrome sizes.
 * Step-after sample stays at `pt.t`; hold follows the pointer at the same `v`.
 *
 * Sample = white empty outline (8px / 10px active, ring 1.5 / 2).
 * Hold = opaque series-colored disc that fits the outline's inner hole (no ring).
 * Link = white stem between outer edges (not through centers).
 */

import { stepPointAt, type StepPoint } from './TimelineView/OverviewCharts/stepPath';

/** Sample outline diameter (border-box) — normal / non-emphasized. */
export const COUNTER_MARKER_PX = 8;
/** Sample outline diameter when hovered / active series. */
export const COUNTER_MARKER_ACTIVE_PX = 10;
/** White ring thickness on the sample outline — normal. */
export const COUNTER_MARKER_RING_PX = 1.5;
/** White ring thickness when hovered / active. */
export const COUNTER_MARKER_RING_ACTIVE_PX = 2;
/** Hide stem when the edge-to-edge gap is below this. */
export const COUNTER_MARKER_LINK_GAP_PX = 2;

export const COUNTER_MARKER_WHITE = '#fff';

/** @deprecated Use COUNTER_MARKER_PX. */
export const COUNTER_MARKER_SAMPLE_PX = COUNTER_MARKER_PX;
/** @deprecated Use `counterMarkerHoldPx`. */
export const COUNTER_MARKER_HOLD_PX = COUNTER_MARKER_PX - 2 * COUNTER_MARKER_RING_PX;

export function counterMarkerSizePx(active: boolean): number {
  return active ? COUNTER_MARKER_ACTIVE_PX : COUNTER_MARKER_PX;
}

export function counterMarkerRingPx(active: boolean): number {
  return active ? COUNTER_MARKER_RING_ACTIVE_PX : COUNTER_MARKER_RING_PX;
}

/** Hold disc diameter — inner hole of the sample outline (exact fit, no ring). */
export function counterMarkerHoldPx(active: boolean): number {
  return Math.max(1, counterMarkerSizePx(active) - 2 * counterMarkerRingPx(active));
}

export function counterMarkerSampleOuterRadiusPx(active: boolean): number {
  return counterMarkerSizePx(active) / 2;
}

export function counterMarkerHoldRadiusPx(active: boolean): number {
  return counterMarkerHoldPx(active) / 2;
}

/**
 * White stem between sample outer edge and hold outer edge.
 * Returns null when the gap is too small (markers overlapping / nested).
 */
export function counterHoldLinkSegment(
  sampleX: number,
  holdX: number,
  active: boolean,
): { left: number; width: number } | null {
  const sampleR = counterMarkerSampleOuterRadiusPx(active);
  const holdR = counterMarkerHoldRadiusPx(active);
  const x0 = Math.min(sampleX, holdX);
  const x1 = Math.max(sampleX, holdX);
  const rLeft = sampleX <= holdX ? sampleR : holdR;
  const rRight = sampleX <= holdX ? holdR : sampleR;
  const width = x1 - x0 - rLeft - rRight;
  if (width < COUNTER_MARKER_LINK_GAP_PX) return null;
  return { left: x0 + rLeft, width };
}

export type CounterMarkerLocal = {
  pt: StepPoint;
  /**
   * X for the sample outline when `sampleVisible`, else the stem’s clipped track-edge
   * endpoint (do not paint a coerced outline on the border).
   */
  sampleLocalX: number;
  holdLocalX: number;
  localY: number;
  linkVisible: boolean;
  /** False when the true sample center sits outside the visible track — clip, don’t coerce. */
  sampleVisible: boolean;
};

/**
 * Clamp a teleported marker's client Y into the canvas/track rect so the disc
 * cannot paint over the timeline header or past the swim bottom.
 */
export function clipCounterMarkerClientY(
  clientY: number,
  canvasRect: { top: number; bottom: number },
  markerPx: number,
): number {
  const half = markerPx / 2;
  return Math.min(canvasRect.bottom - half, Math.max(canvasRect.top + half, clientY));
}

/**
 * Step-after sample + hold geometry in lane-local CSS pixels.
 * `xAtTime` / `yAtValue` map canonical ns / value into the plot.
 * `linkVisible` uses active-sized edge gap so emphasized chrome does not leave a stub.
 *
 * When `trackW` is set: keep the true sample x for visibility; if it lies outside
 * `[0, trackW]`, hide the outline (`sampleVisible: false`) and clip only the stem
 * endpoint to the track edge — never coerce the circle onto the border.
 */
export function counterMarkerLocalGeometry(input: {
  points: readonly StepPoint[];
  cursorTime: number;
  cursorLocalX: number;
  xAtTime: (t: number) => number;
  yAtValue: (v: number) => number;
  /** Inclusive track width in CSS px; sample outside `[0, trackW]` → hide outline, clip stem. */
  trackW?: number;
  /** @deprecated Prefer `trackW`. Clamps sample x into the plot. */
  clampSampleX?: (x: number) => number;
}): CounterMarkerLocal | null {
  const pt = stepPointAt(input.points, input.cursorTime);
  if (!pt) return null;
  const rawSampleX = input.xAtTime(pt.t);
  const holdLocalX = input.cursorLocalX;
  let sampleLocalX = rawSampleX;
  let sampleVisible = true;
  if (input.trackW != null) {
    sampleVisible = rawSampleX >= 0 && rawSampleX <= input.trackW;
    // Stem clips to the track; outline is not moved onto the border when off-track.
    const clipped = Math.min(input.trackW, Math.max(0, rawSampleX));
    sampleLocalX = sampleVisible ? rawSampleX : Math.min(clipped, holdLocalX);
  } else if (input.clampSampleX) {
    sampleLocalX = input.clampSampleX(rawSampleX);
  }
  const localY = input.yAtValue(pt.v);
  const linkVisible = counterHoldLinkSegment(sampleLocalX, holdLocalX, true) != null;
  return { pt, sampleLocalX, holdLocalX, localY, linkVisible, sampleVisible };
}
