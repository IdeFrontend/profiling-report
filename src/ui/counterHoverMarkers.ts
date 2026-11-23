/**
 * Shared CounterTrack / OverviewCharts hover marker geometry + chrome sizes.
 * Step-after sample stays at `pt.t`; hold follows the pointer at the same `v`.
 */

import { stepPointAt, type StepPoint } from './TimelineView/OverviewCharts/stepPath';

/** Filled hold disc (inner sample size). */
export const COUNTER_MARKER_HOLD_PX = 8;
/** Empty sample outline box (border-box) so the inner hole ≈ hold disc. */
export const COUNTER_MARKER_SAMPLE_PX = 11;
/** White ring / stem. */
export const COUNTER_MARKER_RING_PX = 1.5;
/** Hide stem when sample and hold coincide. */
export const COUNTER_MARKER_LINK_GAP_PX = 2;

export const COUNTER_MARKER_WHITE = '#fff';

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
