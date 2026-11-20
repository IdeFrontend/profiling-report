import { describe, expect, it } from 'vitest';
import {
  COUNTER_HOVER_TIP_EST_H,
  COUNTER_HOVER_TIP_EST_W,
  FIXED_TIP_OFFSET_PX,
  FIXED_TIP_PAD_PX,
  placeFixedTip,
} from '../../src/ui/placeFixedTip';

const tip = {
  tipW: COUNTER_HOVER_TIP_EST_W,
  tipH: COUNTER_HOVER_TIP_EST_H,
};

describe('placeFixedTip', () => {
  it('prefers below-right of the pointer when the tip fits', () => {
    const pos = placeFixedTip({
      x: 100,
      y: 80,
      ...tip,
      viewportW: 800,
      viewportH: 600,
    });
    expect(pos).toEqual({
      left: 100 + FIXED_TIP_OFFSET_PX,
      right: null,
      top: 80 + FIXED_TIP_OFFSET_PX,
      bottom: null,
    });
  });

  it('flips above the pointer when below would crop the bottom edge', () => {
    const y = 580;
    const pos = placeFixedTip({
      x: 100,
      y,
      ...tip,
      viewportW: 800,
      viewportH: 600,
    });
    // Bottom edge anchored at y - offset — gap stays offset even if tipH is wrong.
    expect(pos.top).toBeNull();
    expect(pos.bottom).toBe(600 - (y - FIXED_TIP_OFFSET_PX));
    expect(pos.left).toBe(100 + FIXED_TIP_OFFSET_PX);
    expect(pos.right).toBeNull();
  });

  it('flips left of the pointer when right would crop the right edge', () => {
    const x = 750;
    const pos = placeFixedTip({
      x,
      y: 80,
      ...tip,
      viewportW: 800,
      viewportH: 600,
    });
    // Right edge anchored at x - offset — gap equals offset (not tipW-dependent).
    expect(pos.left).toBeNull();
    expect(pos.right).toBe(800 - (x - FIXED_TIP_OFFSET_PX));
    expect(pos.top).toBe(80 + FIXED_TIP_OFFSET_PX);
    expect(pos.bottom).toBeNull();
  });

  it('keeps the same pointer gap when flipped left even if tipW is overestimated', () => {
    const x = 750;
    const fat = placeFixedTip({
      x,
      y: 80,
      tipW: 400,
      tipH: 40,
      viewportW: 800,
      viewportH: 600,
    });
    const slim = placeFixedTip({
      x,
      y: 80,
      tipW: 120,
      tipH: 40,
      viewportW: 800,
      viewportH: 600,
    });
    // Both flip; both anchor the near edge at x - offset.
    expect(fat.right).toBe(slim.right);
    expect(fat.right).toBe(800 - (x - FIXED_TIP_OFFSET_PX));
  });

  it('flips both axes near the bottom-right corner', () => {
    const x = 790;
    const y = 590;
    const pos = placeFixedTip({
      x,
      y,
      ...tip,
      viewportW: 800,
      viewportH: 600,
    });
    expect(pos.left).toBeNull();
    expect(pos.top).toBeNull();
    expect(pos.right).toBe(800 - (x - FIXED_TIP_OFFSET_PX));
    expect(pos.bottom).toBe(600 - (y - FIXED_TIP_OFFSET_PX));
    expect(pos.right).toBeGreaterThanOrEqual(FIXED_TIP_PAD_PX);
    expect(pos.bottom).toBeGreaterThanOrEqual(FIXED_TIP_PAD_PX);
  });

  it('pins left when a left flip would still crop past the left edge', () => {
    const pos = placeFixedTip({
      x: 20,
      y: 80,
      tipW: 200,
      tipH: 40,
      viewportW: 180,
      viewportH: 600,
    });
    expect(pos.left).toBe(FIXED_TIP_PAD_PX);
    expect(pos.right).toBeNull();
  });

  it('pins top when an above flip would still crop past the top edge', () => {
    const pos = placeFixedTip({
      x: 100,
      y: 10,
      tipW: 120,
      tipH: 80,
      viewportW: 800,
      viewportH: 60,
    });
    expect(pos.top).toBe(FIXED_TIP_PAD_PX);
    expect(pos.bottom).toBeNull();
  });
});
