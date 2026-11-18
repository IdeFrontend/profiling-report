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
      top: 80 + FIXED_TIP_OFFSET_PX,
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
    expect(pos.top).toBe(y - FIXED_TIP_OFFSET_PX - COUNTER_HOVER_TIP_EST_H);
    expect(pos.top + COUNTER_HOVER_TIP_EST_H).toBeLessThanOrEqual(600 - FIXED_TIP_PAD_PX);
    expect(pos.left).toBe(100 + FIXED_TIP_OFFSET_PX);
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
    expect(pos.left).toBe(x - FIXED_TIP_OFFSET_PX - COUNTER_HOVER_TIP_EST_W);
    expect(pos.left + COUNTER_HOVER_TIP_EST_W).toBeLessThanOrEqual(800 - FIXED_TIP_PAD_PX);
    expect(pos.top).toBe(80 + FIXED_TIP_OFFSET_PX);
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
    expect(pos.left).toBe(x - FIXED_TIP_OFFSET_PX - COUNTER_HOVER_TIP_EST_W);
    expect(pos.top).toBe(y - FIXED_TIP_OFFSET_PX - COUNTER_HOVER_TIP_EST_H);
    expect(pos.left).toBeGreaterThanOrEqual(FIXED_TIP_PAD_PX);
    expect(pos.top).toBeGreaterThanOrEqual(FIXED_TIP_PAD_PX);
  });

  it('clamps when a left flip would still crop past the left edge', () => {
    const pos = placeFixedTip({
      x: 20,
      y: 80,
      tipW: 200,
      tipH: 40,
      viewportW: 180,
      viewportH: 600,
    });
    expect(pos.left).toBe(FIXED_TIP_PAD_PX);
    expect(pos.left + 200).toBeGreaterThan(180); // tip wider than viewport — still pinned to pad
  });

  it('clamps when an above flip would still crop past the top edge', () => {
    const pos = placeFixedTip({
      x: 100,
      y: 10,
      tipW: 120,
      tipH: 80,
      viewportW: 800,
      viewportH: 60,
    });
    expect(pos.top).toBe(FIXED_TIP_PAD_PX);
  });
});
