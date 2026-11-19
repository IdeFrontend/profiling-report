/**
 * Geometry hit-test for the memory heat grid — swimlane-style continuous hover.
 * Matches `.pr-heat__grid` chrome: 2px border, 2px padding, 2px gap.
 */

export const HEAT_GRID_BORDER_PX = 2;
export const HEAT_GRID_PAD_PX = 2;
export const HEAT_GRID_GAP_PX = 2;

export type HeatHitTestLayout = {
  columns: number;
  rows: number;
  blockCount: number;
};

/**
 * Map a pointer (client coords) to a block index.
 * Seam (gap) pixels stay on the left/top cell so tip/highlight do not thrash.
 * Returns null when outside the padded content; caller keeps sticky hover on chrome.
 */
export function hitTestHeatCell(
  clientX: number,
  clientY: number,
  gridRect: { left: number; top: number; width: number; height: number },
  layout: HeatHitTestLayout,
): number | null {
  const { columns, rows, blockCount } = layout;
  if (columns < 1 || rows < 1 || blockCount < 1) return null;

  // Absolute children / content origin sit inside the border (padding box).
  const x = clientX - gridRect.left - HEAT_GRID_BORDER_PX;
  const y = clientY - gridRect.top - HEAT_GRID_BORDER_PX;
  const padBoxW = gridRect.width - 2 * HEAT_GRID_BORDER_PX;
  const padBoxH = gridRect.height - 2 * HEAT_GRID_BORDER_PX;
  if (x < 0 || y < 0 || x >= padBoxW || y >= padBoxH) return null;

  const innerW = padBoxW - 2 * HEAT_GRID_PAD_PX;
  const innerH = padBoxH - 2 * HEAT_GRID_PAD_PX;
  if (innerW <= 0 || innerH <= 0) return null;

  const lx = x - HEAT_GRID_PAD_PX;
  const ly = y - HEAT_GRID_PAD_PX;
  // Still over padding ring inside the border — sticky (null → keep previous).
  if (lx < 0 || ly < 0 || lx >= innerW || ly >= innerH) return null;

  const cellW = (innerW - (columns - 1) * HEAT_GRID_GAP_PX) / columns;
  const cellH = (innerH - (rows - 1) * HEAT_GRID_GAP_PX) / rows;
  if (cellW <= 0 || cellH <= 0) return null;

  const stepX = cellW + HEAT_GRID_GAP_PX;
  const stepY = cellH + HEAT_GRID_GAP_PX;
  const col = Math.max(0, Math.min(columns - 1, Math.floor(lx / stepX)));
  const row = Math.max(0, Math.min(rows - 1, Math.floor(ly / stepY)));
  const index = row * columns + col;
  if (index < 0 || index >= blockCount) return null;
  return index;
}
