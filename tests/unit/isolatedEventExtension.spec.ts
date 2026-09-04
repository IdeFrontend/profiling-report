import { describe, expect, it } from 'vitest';
import { MAX_QUADS_PER_MESH } from '../../src/swimlane/layout';
import {
  EDGE_GAP,
  eventGapNext,
  eventGapPrev,
  setVbSquareWithGaps,
} from '../../src/swimlane/WebGlSwimlaneRenderer';
import { extendMargin1Css, extendMargin2Css, extendTargetSizeCss } from '../../src/swimlane/shaders';

/** `n` non-overlapping events: start = i*10, end = i*10+5, so every interior gap is 5. */
function lanePairs(n: number): number[] {
  const pairs: number[] = [];
  for (let i = 0; i < n; i++) pairs.push(i * 10, i * 10 + 5);
  return pairs;
}

describe('eventGapPrev', () => {
  it('PR-RENDER-024: the first event uses EDGE_GAP (no predecessor)', () => {
    expect(eventGapPrev(lanePairs(3), 0)).toBe(EDGE_GAP);
  });

  it('PR-RENDER-024: interior and later-chunk events read the real previous distance', () => {
    const pairs = lanePairs(3);
    // [0,5],[10,15],[20,25]: gapPrev[1] = 10-5 = 5, gapPrev[2] = 20-15 = 5.
    expect(eventGapPrev(pairs, 1)).toBe(5);
    expect(eventGapPrev(pairs, 2)).toBe(5);
  });

  it('PR-RENDER-024: the first event of a non-first chunk reads back across the split', () => {
    const pairs = lanePairs(MAX_QUADS_PER_MESH + 2);
    expect(eventGapPrev(pairs, MAX_QUADS_PER_MESH)).toBe(5);
  });
});

describe('eventGapNext', () => {
  it('PR-RENDER-024: the last event uses EDGE_GAP (no successor)', () => {
    expect(eventGapNext(lanePairs(3), 2)).toBe(EDGE_GAP);
  });

  it('PR-RENDER-024: interior and earlier-chunk events read the real next distance', () => {
    const pairs = lanePairs(3);
    // [0,5],[10,15],[20,25]: gapNext[0] = 10-5 = 5, gapNext[1] = 20-15 = 5.
    expect(eventGapNext(pairs, 0)).toBe(5);
    expect(eventGapNext(pairs, 1)).toBe(5);
  });

  it('PR-RENDER-024: the last event of a non-final chunk reads forward across the split', () => {
    const pairs = lanePairs(MAX_QUADS_PER_MESH + 2);
    expect(eventGapNext(pairs, MAX_QUADS_PER_MESH - 1)).toBe(5);
  });
});

describe('setVbSquareWithGaps', () => {
  it('PR-RENDER-024: writes one 6-float/vertex quad with per-quad gaps', () => {
    const vb = new Float32Array(24);
    setVbSquareWithGaps(0, 10, 20, 100, 200, vb);
    expect(Array.from(vb)).toEqual([
      20, -1, 10, 1, 100, 200,
      20, 1, 10, 1, 100, 200,
      10, -1, 20, 0, 100, 200,
      10, 1, 20, 0, 100, 200,
    ]);
  });
});

describe('extension constants', () => {
  it('PR-RENDER-024: pin the edge gap and CSS-px extension policy', () => {
    expect(EDGE_GAP).toBe(1e12);
    expect(extendTargetSizeCss).toBe(1);
    expect(extendMargin1Css).toBe(2);
    expect(extendMargin2Css).toBe(4);
  });
});
