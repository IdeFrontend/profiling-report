import { clampPanelWidth, type HorizontalResizeSession } from '../panelResize';

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

/** True when `colId` has a following column to trade width with. */
export function sourceColCanResize(ids: readonly string[], colId: string): boolean {
  const i = ids.indexOf(colId);
  return i >= 0 && ids[i + 1] != null;
}

/**
 * Move the boundary between `leftId` and the next column by `deltaPx` (positive =
 * grow left / shrink right). Total width is unchanged, so only that divider moves.
 * No-op when `leftId` is the last column (no right neighbor to trade with).
 */
export function applySourceColBoundaryDelta(
  widths: Record<string, number>,
  ids: readonly string[],
  leftId: string,
  deltaPx: number,
): Record<string, number> {
  const i = ids.indexOf(leftId);
  const rightId = i >= 0 ? ids[i + 1] : undefined;
  if (i < 0 || rightId == null || !Number.isFinite(deltaPx) || deltaPx === 0) {
    return widths;
  }

  const left0 = widths[leftId] ?? defaultSourceColWidth(leftId);
  const right0 = widths[rightId] ?? defaultSourceColWidth(rightId);

  // left' = left0 + d, right' = right0 - d — clamp so both stay in [MIN, MAX].
  let d = deltaPx;
  d = Math.max(SOURCE_COL_WIDTH_MIN - left0, Math.min(SOURCE_COL_WIDTH_MAX - left0, d));
  d = Math.max(right0 - SOURCE_COL_WIDTH_MAX, Math.min(right0 - SOURCE_COL_WIDTH_MIN, d));
  d = Math.round(d);
  if (d === 0) return widths;

  return {
    ...widths,
    [leftId]: left0 + d,
    [rightId]: right0 - d,
  };
}

/**
 * Pointer-drag on the right edge of `leftId`. Trades width with the next column
 * so only that shared line moves. Returns null when there is no next column.
 *
 * Column layout uses preferred-px as % of the table. A raw pointer delta is in
 * CSS px of the laid-out table, so without scaling the divider lags the mouse
 * whenever preferredTotal ≠ trackWidthPx. Pass `trackWidthPx` (table clientWidth)
 * to keep the boundary under the cursor 1:1.
 */
export function startSourceColBoundaryResize(opts: {
  startClientX: number;
  leftId: string;
  ids: readonly string[];
  startWidths: Record<string, number>;
  onChange: (widths: Record<string, number>) => void;
  /** Laid-out table width in CSS px (clientWidth). */
  trackWidthPx?: number;
}): HorizontalResizeSession | null {
  if (!sourceColCanResize(opts.ids, opts.leftId)) return null;

  const start = ensureSourceColWidths(opts.ids, opts.startWidths);
  const preferredTotal = sourceColWidthsTotal(start, opts.ids);
  const track =
    opts.trackWidthPx != null && opts.trackWidthPx > 0 ? opts.trackWidthPx : preferredTotal;
  const scale = preferredTotal / track;

  return {
    move(clientX: number) {
      const delta = (clientX - opts.startClientX) * scale;
      const next = applySourceColBoundaryDelta(start, opts.ids, opts.leftId, delta);
      opts.onChange(next);
      return next[opts.leftId] ?? start[opts.leftId] ?? 0;
    },
    end() {
      /* caller clears capture */
    },
  };
}
