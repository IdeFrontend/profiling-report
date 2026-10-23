/** One pane bar measured as a single row: Source + link, then Navigate By. */
export interface PaneBarMeasure {
  lead: number;
  nav: number;
  /** Content box width (padding already removed). */
  available: number;
}

/**
 * Both pane bars share one wrap. If either Source + link + Navigate By row
 * does not fit, both bars use two lines.
 */
export function paneBarsUseTwoLines(bars: readonly PaneBarMeasure[], gap: number): boolean {
  const laidOut = bars.some((b) => b.available > 0 && b.lead + b.nav > 0);
  if (!laidOut) return false;
  return bars.some((b) => b.available > 0 && b.lead + gap + b.nav > b.available + 1);
}
