/**
 * Shared CounterTrack / OverviewCharts hover marker geometry + chrome sizes.
 * Step-after sample stays at `pt.t`; hold follows the pointer at the same `v`.
 *
 * Sizes match the original OverviewCharts value-dot (8px / 10px active, 1.5 / 2px ring).
 */

import { stepPointAt, type StepPoint } from './TimelineView/OverviewCharts/stepPath';

/** Marker diameter (border-box) — normal / non-emphasized. */
export const COUNTER_MARKER_PX = 8;
/** Marker diameter when hovered / active series. */
export const COUNTER_MARKER_ACTIVE_PX = 10;
/** White ring thickness — normal. */
export const COUNTER_MARKER_RING_PX = 1.5;
/** White ring thickness when hovered / active. */
export const COUNTER_MARKER_RING_ACTIVE_PX = 2;
/** Hide stem when sample and hold coincide. */
export const COUNTER_MARKER_LINK_GAP_PX = 2;

export const COUNTER_MARKER_WHITE = '#fff';

/** @deprecated Use COUNTER_MARKER_PX — hold and sample share one size. */
export const COUNTER_MARKER_HOLD_PX = COUNTER_MARKER_PX;
/** @deprecated Use COUNTER_MARKER_PX — hold and sample share one size. */
export const COUNTER_MARKER_SAMPLE_PX = COUNTER_MARKER_PX;

export function counterMarkerSizePx(active: boolean): number {
  return active ? COUNTER_MARKER_ACTIVE_PX : COUNTER_MARKER_PX;
}

export function counterMarkerRingPx(active: boolean): number {
  return active ? COUNTER_MARKER_RING_ACTIVE_PX : COUNTER_MARKER_RING_PX;
}

export type CounterMarkerLocal = {
  pt: StepPoint;
  sampleLocalX: number;
  holdLocalX: number;
  localY: number;
  linkVisible: boolean;
};

/**
 * Step-after sample + hold geometry in lane-local CSS pixels.
 * `xAtTime` / `yAtValue` map canonical ns / value into the plot.
 */
export function counterMarkerLocalGeometry(input: {
  points: readonly StepPoint[];
  cursorTime: number;
  cursorLocalX: number;
  xAtTime: (t: number) => number;
  yAtValue: (v: number) => number;
  /** Clamp sample x into the plot (e.g. `[0, trackW]`). */
  clampSampleX?: (x: number) => number;
}): CounterMarkerLocal | null {
  const pt = stepPointAt(input.points, input.cursorTime);
  if (!pt) return null;
  let sampleLocalX = input.xAtTime(pt.t);
  if (input.clampSampleX) sampleLocalX = input.clampSampleX(sampleLocalX);
  const holdLocalX = input.cursorLocalX;
  const localY = input.yAtValue(pt.v);
  const linkVisible = Math.abs(holdLocalX - sampleLocalX) >= COUNTER_MARKER_LINK_GAP_PX;
  return { pt, sampleLocalX, holdLocalX, localY, linkVisible };
}
