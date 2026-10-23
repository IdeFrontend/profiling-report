import { describe, expect, it } from 'vitest';
import { paneBarsUseTwoLines } from './paneBarLayout';

describe('paneBarsUseTwoLines', () => {
  it('stays one line while both bars fit', () => {
    expect(paneBarsUseTwoLines([
      { lead: 200, nav: 180, available: 500 },
      { lead: 240, nav: 180, available: 500 },
    ], 10)).toBe(false);
  });

  it('wraps both when only the right bar overflows', () => {
    expect(paneBarsUseTwoLines([
      { lead: 200, nav: 180, available: 500 },
      { lead: 360, nav: 180, available: 500 },
    ], 10)).toBe(true);
  });

  it('ignores bars that have not been laid out', () => {
    expect(paneBarsUseTwoLines([
      { lead: 0, nav: 0, available: 0 },
      { lead: 0, nav: 0, available: 0 },
    ], 10)).toBe(false);
  });
});
