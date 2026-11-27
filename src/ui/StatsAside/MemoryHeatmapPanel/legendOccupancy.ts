/** Min painted width for a single-intensity occupancy band on the legend strip. */
export const LEGEND_OCC_MIN_PX = 3;

/**
 * Merge unique intensities into ≥3px occupancy bands on the legend strip.
 * Each intensity maps to `intensity × 100` percent; expansions overlap → one band.
 */
export function mergeOccupancyBands(
  intensities: readonly number[],
  trackWidthPx: number,
): { leftPct: number; widthPct: number }[] {
  if (trackWidthPx <= 0 || intensities.length === 0) return [];
  const minPct = (LEGEND_OCC_MIN_PX / trackWidthPx) * 100;
  const pcts = [
    ...new Set(
      intensities.map((raw) => {
        const pct = Math.min(1, Math.max(0, raw)) * 100;
        return Math.round(pct * 100) / 100;
      }),
    ),
  ].sort((a, b) => a - b);

  const intervals: { lo: number; hi: number }[] = [];
  for (const pct of pcts) {
    let lo = pct - minPct / 2;
    let hi = pct + minPct / 2;
    // Keep ≥ minPct at the edges by shifting into the strip.
    if (lo < 0) {
      hi = Math.min(100, hi - lo);
      lo = 0;
    }
    if (hi > 100) {
      lo = Math.max(0, lo - (hi - 100));
      hi = 100;
    }
    intervals.push({ lo, hi });
  }

  const merged: { leftPct: number; widthPct: number }[] = [];
  for (const { lo, hi } of intervals) {
    const last = merged[merged.length - 1];
    if (last && lo <= last.leftPct + last.widthPct) {
      const end = Math.max(last.leftPct + last.widthPct, hi);
      last.widthPct = end - last.leftPct;
    } else {
      merged.push({ leftPct: lo, widthPct: hi - lo });
    }
  }
  return merged;
}
