import type { LaneCategoryKey } from '../../../../domain/types';

/** Display payload for a gutter util bar (metric-aware). */
export type GutterBarDisplay = {
  /** Fill width 0–100 (percent of track). */
  barWidth: number;
  /** Text inside thick bar (right-aligned); omit display when empty. */
  label: string;
  /** When true, apply red/gray threshold coloring (利用率 mode). */
  thresholdColor?: boolean;
};

export type GutterLane = {
  id: string;
  name: string;
  /** @deprecated Prefer `bar` — retained for pipe-ratio default during migration. */
  utilization?: number;
  color: string;
  /** Metric-derived bar display; when set, drives util column rendering. */
  bar?: GutterBarDisplay;
  /** Present ⇒ folder (may be [] when collapsed). */
  children?: GutterLane[];
  /** When set, gutter localizes the label via i18n lane* keys. */
  categoryKey?: LaneCategoryKey;
};

export type GutterGroup = {
  id: string;
  name: string;
  lanes: GutterLane[];
};
