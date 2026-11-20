import type { LaneCategoryKey } from '../../../../domain/types';

export type { GutterBarDisplay, GutterMetric } from '../../../../domain/gutterMetrics';

import type { GutterBarDisplay } from '../../../../domain/gutterMetrics';

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
  /** Sub-rows for a multi-row leaf; the gutter renders one tall title cell. */
  rowCount?: number;
  /** CounterTrack leaf — gutter row uses `COUNTER_LANE_HEIGHT` (24), not `rowCount × 22`. */
  counter?: boolean;
};

export type GutterGroup = {
  id: string;
  name: string;
  lanes: GutterLane[];
  /** Dashed midline position (% of util track); omit when not applicable. */
  utilMidlinePercent?: number;
};
