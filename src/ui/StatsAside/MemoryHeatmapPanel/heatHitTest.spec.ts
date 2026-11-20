import { describe, expect, it } from 'vitest';
import {
  HEAT_GRID_BORDER_PX,
  HEAT_GRID_GAP_PX,
  HEAT_GRID_PAD_PX,
  hitTestHeatCell,
} from './heatHitTest';

/** 2×2 grid, 10px cells → padBox 24, outer 28 (border×2). */
const CELL = 10;
const COLS = 2;
const ROWS = 2;
const INNER = COLS * CELL + (COLS - 1) * HEAT_GRID_GAP_PX; // 22
const PAD_BOX = INNER + 2 * HEAT_GRID_PAD_PX; // 26
const OUTER = PAD_BOX + 2 * HEAT_GRID_BORDER_PX; // 30

const rect = { left: 0, top: 0, width: OUTER, height: OUTER };
const layout = { columns: COLS, rows: ROWS, blockCount: 4 };

function at(padLocalX: number, padLocalY: number) {
  // client = border + pad-local
  return hitTestHeatCell(
    HEAT_GRID_BORDER_PX + padLocalX,
    HEAT_GRID_BORDER_PX + padLocalY,
    rect,
    layout,
  );
}

describe('hitTestHeatCell', () => {
  it('maps cell centers to row-major indices', () => {
    // Content origin after pad: cell0 center at pad+CELL/2
    expect(at(HEAT_GRID_PAD_PX + CELL / 2, HEAT_GRID_PAD_PX + CELL / 2)).toBe(0);
    expect(at(HEAT_GRID_PAD_PX + CELL + HEAT_GRID_GAP_PX + CELL / 2, HEAT_GRID_PAD_PX + CELL / 2)).toBe(
      1,
    );
    expect(at(HEAT_GRID_PAD_PX + CELL / 2, HEAT_GRID_PAD_PX + CELL + HEAT_GRID_GAP_PX + CELL / 2)).toBe(
      2,
    );
    expect(
      at(
        HEAT_GRID_PAD_PX + CELL + HEAT_GRID_GAP_PX + CELL / 2,
        HEAT_GRID_PAD_PX + CELL + HEAT_GRID_GAP_PX + CELL / 2,
      ),
    ).toBe(3);
  });

  it('attributes seam (gap) pixels to the left/top cell — no thrash', () => {
    // Gap after cell 0: content x in [CELL, CELL+GAP)
    const gapX = HEAT_GRID_PAD_PX + CELL + HEAT_GRID_GAP_PX / 2;
    const midY = HEAT_GRID_PAD_PX + CELL / 2;
    expect(at(gapX, midY)).toBe(0);
  });

  it('returns null outside the pad box (caller keeps sticky) and outside the element', () => {
    expect(at(1, HEAT_GRID_PAD_PX + CELL / 2)).toBeNull(); // in padding ring
    expect(hitTestHeatCell(-1, 10, rect, layout)).toBeNull();
    expect(hitTestHeatCell(OUTER + 1, 10, rect, layout)).toBeNull();
  });
});
