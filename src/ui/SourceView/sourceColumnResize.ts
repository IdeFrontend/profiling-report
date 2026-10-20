import { clampPanelWidth, startHorizontalResize } from '../panelResize';

/** Default Source / SASS metrics column widths (px). */
export const SOURCE_COL_WIDTH_DEFAULT: Record<string, number> = {
  line: 52,
  address: 148,
  assembly: 280,
  instructionsExecuted: 120,
  samplingStall: 120,
  warpOccupancy: 140,
};

export const SOURCE_COL_WIDTH_MIN = 48;
export const SOURCE_COL_WIDTH_MAX = 640;

export function defaultSourceColWidth(colId: string): number {
  return SOURCE_COL_WIDTH_DEFAULT[colId] ?? 100;
}

export function clampSourceColWidth(px: number): number {
  return clampPanelWidth(px, SOURCE_COL_WIDTH_MIN, SOURCE_COL_WIDTH_MAX);
}

/** Build initial width map for a column id list (preserves existing entries). */
export function ensureSourceColWidths(
  ids: readonly string[],
  prev: Record<string, number> = {},
): Record<string, number> {
  const next: Record<string, number> = { ...prev };
  for (const id of ids) {
    if (next[id] == null || !Number.isFinite(next[id])) {
      next[id] = defaultSourceColWidth(id);
    } else {
      next[id] = clampSourceColWidth(next[id]!);
    }
  }
  return next;
}

export function sourceColWidthsTotal(widths: Record<string, number>, ids: readonly string[]): number {
  return ids.reduce((sum, id) => sum + (widths[id] ?? defaultSourceColWidth(id)), 0);
}

/**
 * Pointer-drag resize for one column. Returns the session so the caller can
 * forward pointermove / pointerup (same pattern as aside resize).
 */
export function startSourceColResize(opts: {
  startClientX: number;
  startWidth: number;
  onChange: (width: number) => void;
}): ReturnType<typeof startHorizontalResize> {
  return startHorizontalResize({
    startClientX: opts.startClientX,
    startWidth: opts.startWidth,
    min: SOURCE_COL_WIDTH_MIN,
    max: SOURCE_COL_WIDTH_MAX,
    direction: 1,
    onChange: opts.onChange,
  });
}
