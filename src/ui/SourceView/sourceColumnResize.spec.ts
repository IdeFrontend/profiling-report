import { describe, expect, it } from 'vitest';
import {
  clampSourceColWidth,
  ensureSourceColWidths,
  sourceColWidthsTotal,
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
});
