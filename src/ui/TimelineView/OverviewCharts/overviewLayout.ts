/** Shared overview track sizing (v930 + SwimlaneView scroll pad). */
export const OVERVIEW_TRACK_H = 16;
export const OVERVIEW_TRACK_GAP = 8;
export const OVERVIEW_HEADER_H = 28;

export function overviewSectionHeightPx(seriesCount: number): number {
  if (seriesCount <= 0) return 0;
  return OVERVIEW_HEADER_H + seriesCount * OVERVIEW_TRACK_H + seriesCount * OVERVIEW_TRACK_GAP + 4;
}
