import { describe, expect, it } from 'vitest';
import { HEAT_GRID_GAP_PX } from './heatHitTest';
import {
  heatGridFrameSizeCss,
  paintHeatLattice,
  pathRoundRect,
  type HeatPaintContext,
} from './paintHeatLattice';

function mockCtx() {
  const fills: string[] = [];
  const ops: string[] = [];
  const ctx: HeatPaintContext & { fills: string[]; ops: string[] } = {
    fillStyle: '',
    fills,
    ops,
    beginPath() {
      ops.push('beginPath');
    },
    moveTo(x, y) {
      ops.push(`moveTo:${x},${y}`);
    },
    lineTo(x, y) {
      ops.push(`lineTo:${x},${y}`);
    },
    quadraticCurveTo(cpx, cpy, x, y) {
      ops.push(`quad:${cpx},${cpy},${x},${y}`);
    },
    closePath() {
      ops.push('closePath');
    },
    fill() {
      fills.push(String(this.fillStyle));
      ops.push('fill');
    },
    clearRect(x, y, w, h) {
      ops.push(`clear:${x},${y},${w},${h}`);
    },
    setTransform(a, b, c, d, e, f) {
      ops.push(`setTransform:${a},${b},${c},${d},${e},${f}`);
    },
  };
  return ctx;
}

describe('paintHeatLattice', () => {
  it('sets DPR transform, clears, and paints every cell when mask is omitted', () => {
    const ctx = mockCtx();
    paintHeatLattice({
      ctx,
      columns: 2,
      rows: 2,
      innerWidthCss: 22,
      innerHeightCss: 22,
      devicePixelRatio: 2,
      fills: ['#a', '#b', '#c', '#d'],
    });
    expect(ctx.ops[0]).toBe('setTransform:2,0,0,2,0,0');
    expect(ctx.ops[1]).toBe('clear:0,0,22,22');
    expect(ctx.fills).toEqual(['#a', '#b', '#c', '#d']);
    // cellW = (22 - 2) / 2 = 10; first cell at 0,0
    expect(ctx.ops.some((o) => o.startsWith('moveTo:1,0'))).toBe(true);
  });

  it('paints only mask bits when mask is provided', () => {
    const ctx = mockCtx();
    const mask = new Uint8Array([0, 1, 0, 1]);
    paintHeatLattice({
      ctx,
      columns: 2,
      rows: 2,
      innerWidthCss: 22,
      innerHeightCss: 22,
      devicePixelRatio: 1,
      fills: ['#a', '#b', '#c', '#d'],
      mask,
    });
    expect(ctx.fills).toEqual(['#b', '#d']);
  });

  it('pathRoundRect closes a rounded path', () => {
    const ctx = mockCtx();
    pathRoundRect(ctx, 0, 0, 10, 10, 1);
    expect(ctx.ops[0]).toBe('beginPath');
    expect(ctx.ops.at(-1)).toBe('closePath');
  });

  it('heatGridFrameSizeCss matches hit-test chrome math', () => {
    const cell = 10;
    const cols = 2;
    const rows = 2;
    const size = heatGridFrameSizeCss(cols, rows, cell);
    expect(size.innerWidth).toBe(cols * cell + (cols - 1) * HEAT_GRID_GAP_PX);
    expect(size.width).toBe(size.innerWidth + 8);
    expect(size.height).toBe(size.innerHeight + 8);
  });
});
