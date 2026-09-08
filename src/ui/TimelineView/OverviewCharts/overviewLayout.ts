/** Shared overview track sizing (v930 + SwimlaneView scroll pad). */
export const OVERVIEW_TRACK_H = 16;
/** @deprecated Gaps replaced by 1px lane-style dividers; kept for import stability. */
export const OVERVIEW_TRACK_GAP = 0;
/** Card-like section header (matches LANE_GROUP_HEADER_HEIGHT). */
export const OVERVIEW_HEADER_H = 40;

/**
 * Scroll-body content top pad for the 统计分析 block.
 * Collapsed → header only; expanded → header + 16px tracks (1px borders inside box).
 */
export function overviewSectionHeightPx(seriesCount: number, collapsed = false): number {
  if (seriesCount <= 0) return 0;
  if (collapsed) return OVERVIEW_HEADER_H;
  return OVERVIEW_HEADER_H + seriesCount * OVERVIEW_TRACK_H;
}
