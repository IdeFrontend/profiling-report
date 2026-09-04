import { describe, expect, it } from 'vitest';
import { MAX_QUADS_PER_MESH } from '../../src/swimlane/layout';
import {
  EDGE_GAP,
  eventGapNext,
  eventGapPrev,
  gapsForIndices,
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

describe('gapsForIndices (emphasis / sparse packs)', () => {
  it('PR-RENDER-025: sparse indices keep whole-lane neighbors, not subsequence gaps', () => {
    // Full lane: [0,1],[10,11],[20,21]. Bright bucket picks events 0 and 2 (skips middle).
    // Subsequence pairs [0,1,20,21] would yield gapNext(0)=19; whole-lane must yield 9.
    const pairs = [0, 1, 10, 11, 20, 21];
    const bright = gapsForIndices(pairs, [0, 2]);
    expect(bright).toEqual([
      { gapPrev: EDGE_GAP, gapNext: 9 },
      { gapPrev: 9, gapNext: EDGE_GAP },
    ]);
    // Contrast: same events packed as a fake 2-event lane (the old emphasis bug).
    const subsequenceBug = gapsForIndices([0, 1, 20, 21], [0, 1]);
    expect(subsequenceBug[0]!.gapNext).toBe(19);
    expect(subsequenceBug[0]!.gapNext).not.toBe(bright[0]!.gapNext);
  });

  it('PR-RENDER-025: a single-index bucket still gets EDGE_GAP on both sides', () => {
    const pairs = lanePairs(3);
    expect(gapsForIndices(pairs, [1])).toEqual([{ gapPrev: 5, gapNext: 5 }]);
    expect(gapsForIndices(pairs, [0])).toEqual([{ gapPrev: EDGE_GAP, gapNext: 5 }]);
  });

  it('PR-RENDER-025: index at a chunk boundary still reads the real prev across the split', () => {
    const pairs = lanePairs(MAX_QUADS_PER_MESH + 2);
    const gaps = gapsForIndices(pairs, [MAX_QUADS_PER_MESH]);
    expect(gaps).toEqual([{ gapPrev: 5, gapNext: 5 }]);
  });
});
