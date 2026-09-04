import { describe, expect, it } from 'vitest';
import {
  eventFill,
  eventStateOf,
  labelColorOn,
  LANE_COLOR_HEX,
  laneColorKey,
} from '../../src/domain/laneColors';
import { hexToOklch, oklchToHex } from '../../src/domain/oklch';

const L = (hex: string): number => hexToOklch(hex)!.L;
const C = (hex: string): number => hexToOklch(hex)!.C;

describe('oklch', () => {
  it('round-trips every lane colour back to itself', () => {
    for (const [key, hex] of Object.entries(LANE_COLOR_HEX)) {
      expect(oklchToHex(hexToOklch(hex)!), key).toBe(hex.toLowerCase());
    }
  });

  it('anchors on known values', () => {
    expect(L('#ffffff')).toBeCloseTo(1, 3);
    expect(L('#000000')).toBeCloseTo(0, 3);
    expect(C('#808080')).toBeCloseTo(0, 3);
    expect(oklchToHex({ L: 1, C: 0, h: 0 })).toBe('#ffffff');
  });

  it('gives up chroma, not lightness or hue, when asked for a colour outside sRGB', () => {
    const base = hexToOklch('#985000')!;
    // Way beyond what sRGB holds at this lightness.
    const clipped = hexToOklch(oklchToHex({ L: 0.9, C: 0.4, h: base.h }))!;
    expect(clipped.L).toBeCloseTo(0.9, 2);
    expect(clipped.h).toBeCloseTo(base.h, 1);
    expect(clipped.C).toBeLessThan(0.4);
  });

  it('rejects anything that is not a 6-digit hex', () => {
    expect(hexToOklch('#abc')).toBeNull();
    expect(hexToOklch('var(--pr-color-cube)')).toBeNull();
  });
});

describe('eventFill', () => {
  it('offsets every lane colour by the state deltas, in perceptual lightness', () => {
    for (const [key, base] of Object.entries(LANE_COLOR_HEX)) {
      const l0 = L(base);
      expect(eventFill(base, 'normal'), key).toBe(base);
      // 8-bit output, so allow a quantisation wobble but not a drifting step.
      expect(L(eventFill(base, 'hover')) - l0, `${key} hover`).toBeCloseTo(0.33, 2);
      expect(L(eventFill(base, 'selected')) - l0, `${key} selected`).toBeCloseTo(0.33, 2);
    }
  });

  it('shares lightness between hover and selected; chroma carries the distinction', () => {
    for (const [key, base] of Object.entries(LANE_COLOR_HEX)) {
      expect(L(eventFill(base, 'selected')) - L(eventFill(base, 'hover')), key).toBeCloseTo(0, 2);
    }
  });

  it('lifts chroma on selected only, where the gamut allows it', () => {
    // A hue with headroom at high lightness; the oranges clip and are covered above.
    const base = LANE_COLOR_HEX.scalar;
    expect(C(eventFill(base, 'hover'))).toBeCloseTo(C(base), 2);
    expect(C(eventFill(base, 'selected'))).toBeGreaterThan(C(base));
  });

  it('passes through anything that is not a 6-digit hex', () => {
    expect(eventFill('var(--pr-color-cube)', 'hover')).toBe('var(--pr-color-cube)');
    expect(eventFill('#abc', 'selected')).toBe('#abc');
  });
});

describe('labelColorOn', () => {
  it('flips at L 0.6 rather than per state', () => {
    expect(labelColorOn('#000000')).toBe('#ffffff');
    expect(labelColorOn('#ffffff')).toBe('#000000');
    for (const [key, base] of Object.entries(LANE_COLOR_HEX)) {
      for (const state of ['normal', 'hover', 'selected'] as const) {
        const fill = eventFill(base, state);
        const expected = L(fill) > 0.6 ? '#000000' : '#ffffff';
        expect(labelColorOn(fill), `${key}/${state}`).toBe(expected);
      }
    }
  });

  it('inverts on hover, because both lifts clear the threshold', () => {
    // Accepted, not overlooked. Holding hover below the flip is what made it too weak to
    // notice; if a lane ever stops flipping, its hover has drifted back down there.
    for (const [key, base] of Object.entries(LANE_COLOR_HEX)) {
      expect(labelColorOn(eventFill(base, 'normal')), `${key}/normal`).toBe('#ffffff');
      expect(labelColorOn(eventFill(base, 'hover')), `${key}/hover`).toBe('#000000');
      expect(labelColorOn(eventFill(base, 'selected')), `${key}/selected`).toBe('#000000');
    }
  });
});

describe('eventStateOf', () => {
  it('ranks selected over hover', () => {
    expect(eventStateOf('a', 'a', 'a')).toBe('selected');
    expect(eventStateOf('a', null, 'a')).toBe('hover');
    expect(eventStateOf('a', 'b', 'c')).toBe('normal');
  });
});

describe('laneColorKey', () => {
  it('matches CoreN.*/PIPE on the pipe suffix (not Core/Vec tokens)', () => {
    expect(laneColorKey('Core0.Vec0/MTE3')).toBe('mte3');
    expect(laneColorKey('Core0.Vec0/ALL')).toBe('default');
    expect(laneColorKey('Core0.Cube/ALL')).toBe('default');
    expect(laneColorKey('Core0.Cube/FLOWCTRL')).toBe('default');
    expect(laneColorKey('Core0.Cube/CACHEMISS')).toBe('default');
    expect(laneColorKey('Core0.Cube/SCALAR')).toBe('scalar');
    expect(laneColorKey('Core0.Cube/CUBE')).toBe('cube');
  });

  it('keeps AIV pipe-state names intact (no Core*.*/PIPE suffix rule)', () => {
    expect(laneColorKey('AIV0/PIPE_V/status')).toBe('vector');
    expect(laneColorKey('AIV0/PIPE_S/status')).toBe('scalar');
  });
});
