/** Shared overview track sizing (v930 + SwimlaneView scroll pad). */
export const OVERVIEW_TRACK_H = 16;
/** Empty band above the 16px paint area; part of the lane hit target. */
export const OVERVIEW_TRACK_GAP = 8;
/** Full lane height = gap + chart paint. */
export const OVERVIEW_LANE_H = OVERVIEW_TRACK_H + OVERVIEW_TRACK_GAP;
/** Card-like section header (matches LANE_GROUP_HEADER_HEIGHT). */
export const OVERVIEW_HEADER_H = 40;
/**
 * Shared Y domain for overview util counters (%). Same scale on every track so
 * peaks are comparable (not per-series auto-scale). Non-% counters clamp — see
 * OverviewCharts.spec.md.
 */
export const OVERVIEW_Y_MAX = 100;

/**
 * Scroll-body content top pad for the 统计分析 block.
 * Collapsed → header only; expanded → header + 24px lanes (8px gap + 16px chart).
 */
export function overviewSectionHeightPx(seriesCount: number, collapsed = false): number {
  if (seriesCount <= 0) return 0;
  if (collapsed) return OVERVIEW_HEADER_H;
  return OVERVIEW_HEADER_H + seriesCount * OVERVIEW_LANE_H;
}
