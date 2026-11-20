/**
 * Canvas 2D painter for the memory heat lattice — geometry matches heatHitTest
 * (pad origin, gap, square cells). Used for the base layer and the bright overlay.
 */

import { HEAT_GRID_BORDER_PX, HEAT_GRID_GAP_PX, HEAT_GRID_PAD_PX } from './heatHitTest';

/** Minimal 2D context surface used by the painter (real CanvasRenderingContext2D or mock). */
export type HeatPaintContext = {
  fillStyle: string;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  closePath(): void;
  fill(): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
};

const CELL_RADIUS_PX = 1;

/** Rounded-rect path in CSS pixel space (caller sets transform / fillStyle). */
export function pathRoundRect(
  ctx: HeatPaintContext,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

export type PaintHeatLatticeArgs = {
  ctx: HeatPaintContext;
  columns: number;
  rows: number;
  /** Inner board width/height in CSS px (content inside padding, no border). */
  innerWidthCss: number;
  innerHeightCss: number;
  devicePixelRatio: number;
  /** Per-block fill colors, row-major, length >= columns*rows (or blockCount). */
  fills: readonly string[];
  /**
   * When set, only indices with bit === 1 are drawn (bright layer).
   * When omitted, every block with a fill is drawn (base layer).
   */
  mask?: Uint8Array | null;
  blockCount?: number;
};

/**
 * Clear and paint heat cells into `ctx`. Sets transform for DPR; leaves fillStyle
 * as the last cell color.
 */
export function paintHeatLattice(args: PaintHeatLatticeArgs): void {
  const {
    ctx,
    columns,
    rows,
    innerWidthCss,
    innerHeightCss,
    devicePixelRatio,
    fills,
    mask = null,
  } = args;
  const blockCount = args.blockCount ?? fills.length;
  const dpr = Math.max(1, devicePixelRatio || 1);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, innerWidthCss, innerHeightCss);

  if (columns < 1 || rows < 1 || blockCount < 1) return;
  if (innerWidthCss <= 0 || innerHeightCss <= 0) return;

  const cellW = (innerWidthCss - (columns - 1) * HEAT_GRID_GAP_PX) / columns;
  const cellH = (innerHeightCss - (rows - 1) * HEAT_GRID_GAP_PX) / rows;
  if (cellW <= 0 || cellH <= 0) return;

  const stepX = cellW + HEAT_GRID_GAP_PX;
  const stepY = cellH + HEAT_GRID_GAP_PX;
  const n = Math.min(blockCount, fills.length, columns * rows);

  for (let i = 0; i < n; i++) {
    if (mask != null && mask[i] !== 1) continue;
    const fill = fills[i];
    if (!fill) continue;
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = col * stepX;
    const y = row * stepY;
    ctx.fillStyle = fill;
    pathRoundRect(ctx, x, y, cellW, cellH, CELL_RADIUS_PX);
    ctx.fill();
  }
}

/** CSS pixel size of the full grid frame (border + pad + cells + gaps). */
export function heatGridFrameSizeCss(
  columns: number,
  rows: number,
  cellCss: number,
): { width: number; height: number; innerWidth: number; innerHeight: number } {
  const gap = HEAT_GRID_GAP_PX;
  const innerWidth = columns * cellCss + Math.max(0, columns - 1) * gap;
  const innerHeight = rows * cellCss + Math.max(0, rows - 1) * gap;
  return {
    innerWidth,
    innerHeight,
    width: innerWidth + 2 * HEAT_GRID_PAD_PX + 2 * HEAT_GRID_BORDER_PX,
    height: innerHeight + 2 * HEAT_GRID_PAD_PX + 2 * HEAT_GRID_BORDER_PX,
  };
}
