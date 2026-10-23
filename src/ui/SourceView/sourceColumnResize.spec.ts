import { describe, expect, it, vi } from 'vitest';
import {
  applySourceColBoundaryDelta,
  clampSourceColWidth,
  ensureSourceColWidths,
  sourceColCanResize,
  sourceColWidthsTotal,
  startSourceColBoundaryResize,
  SOURCE_COL_WIDTH_MAX,
  SOURCE_COL_WIDTH_MIN,
} from './sourceColumnResize';

describe('sourceColumnResize', () => {
  it('fills defaults and clamps existing widths', () => {
    const w = ensureSourceColWidths(['line', 'assembly'], { assembly: 20 });
    expect(w.line).toBeGreaterThanOrEqual(SOURCE_COL_WIDTH_MIN);
    expect(w.assembly).toBe(SOURCE_COL_WIDTH_MIN);
  });

  it('sums widths for table min-width', () => {
    const w = ensureSourceColWidths(['a', 'b'], { a: 100, b: 200 });
    expect(sourceColWidthsTotal(w, ['a', 'b'])).toBe(300);
  });

  it('clamps to min/max', () => {
    expect(clampSourceColWidth(10)).toBe(SOURCE_COL_WIDTH_MIN);
    expect(clampSourceColWidth(9999)).toBe(SOURCE_COL_WIDTH_MAX);
  });

  it('trades width with the next column so total stays fixed', () => {
    const ids = ['a', 'b', 'c'] as const;
    const start = { a: 100, b: 100, c: 100 };
    const next = applySourceColBoundaryDelta(start, ids, 'a', 40);
    expect(next).toEqual({ a: 140, b: 60, c: 100 });
    expect(sourceColWidthsTotal(next, ids)).toBe(300);
    // Only the a|b boundary moved — c unchanged.
    expect(next.c).toBe(100);
  });

  it('stops when the neighbor hits the min width', () => {
    const ids = ['a', 'b'] as const;
    const start = { a: 100, b: SOURCE_COL_WIDTH_MIN + 10 };
    const next = applySourceColBoundaryDelta(start, ids, 'a', 100);
    expect(next.b).toBe(SOURCE_COL_WIDTH_MIN);
    expect(next.a).toBe(100 + 10);
  });

  it('no-ops on the last column (no right neighbor)', () => {
    const ids = ['a', 'b'] as const;
    const start = { a: 100, b: 100 };
    expect(applySourceColBoundaryDelta(start, ids, 'b', 40)).toBe(start);
    expect(sourceColCanResize(ids, 'a')).toBe(true);
    expect(sourceColCanResize(ids, 'b')).toBe(false);
  });

  it('scales pointer delta by preferredTotal/trackWidth so the divider tracks the mouse', () => {
    const ids = ['a', 'b'] as const;
    const start = { a: 200, b: 200 }; // preferred total 400
    const onChange = vi.fn();
    // Laid-out table is half as wide — raw 20px mouse must become 40 preferred-px.
    const session = startSourceColBoundaryResize({
      startClientX: 100,
      leftId: 'a',
      ids,
      startWidths: start,
      onChange,
      trackWidthPx: 200,
    });
    expect(session).not.toBeNull();
    session!.move(120);
    expect(onChange).toHaveBeenCalledWith({ a: 240, b: 160 });
  });
});
