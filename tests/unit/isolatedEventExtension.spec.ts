import { describe, expect, it } from 'vitest';
import { MAX_QUADS_PER_MESH } from '../../src/swimlane/layout';
import {
  computeChunkGaps,
  EDGE_GAP,
  setVbSquareWithGaps,
} from '../../src/swimlane/WebGlSwimlaneRenderer';
import { extendMargin1Css, extendMargin2Css, extendTargetSizeCss } from '../../src/swimlane/shaders';

/** [start, end] pairs for `n` non-overlapping events: start = i*10, end = i*10+5, gap = 5. */
function lanePairs(n: number): number[] {
  const pairs: number[] = [];
  for (let i = 0; i < n; i++) {
    pairs.push(i * 10, i * 10 + 5);
  }
  return pairs;
}

/**
 * `computeChunkGaps` returns a `Float32Array`, so `EDGE_GAP` (1e12) is rounded to the nearest
 * single-precision value (999999995904). The shader only needs "huge", so this is correct — but
 * assertions must compare against the float32 form, not the double-precision literal.
 */
const EDGE_GAP_F32 = Math.fround(EDGE_GAP);

describe('computeChunkGaps', () => {
  it('PR-RENDER-024: returns an empty array for an empty lane', () => {
    expect(computeChunkGaps([])).toEqual(new Float32Array(0));
  });

  it('PR-RENDER-024: a single event gets EDGE_GAP on both sides', () => {
    expect(computeChunkGaps([10, 15])).toEqual(new Float32Array([EDGE_GAP_F32, EDGE_GAP_F32]));
  });

  it('PR-RENDER-024: interior gaps are the exact nearest-neighbor distance', () => {
    // Three events: [0,5], [20,25], [40,45]. gapPrev[1] = 20-5 = 15; gapNext[1] = 40-25 = 15.
    const gaps = computeChunkGaps([0, 5, 20, 25, 40, 45]);
    expect(Array.from(gaps)).toEqual([EDGE_GAP_F32, 15, 15, 15, 15, EDGE_GAP_F32]);
  });

  it('PR-RENDER-024: boundary sides use EDGE_GAP, never a neighbor distance', () => {
    const gaps = computeChunkGaps(lanePairs(3));
    expect(gaps[0]).toBe(EDGE_GAP_F32); // first event gapPrev
    expect(gaps[1]).toBe(5); // first event gapNext = 10 - 5
    expect(gaps[gaps.length - 2]).toBe(5); // last event gapPrev
    expect(gaps[gaps.length - 1]).toBe(EDGE_GAP_F32); // last event gapNext
  });

  it('PR-RENDER-024: a lane past MAX_QUADS_PER_MESH keeps a real gapNext on the first chunk boundary', () => {
    // 16385 events; the last event of the first chunk (index MAX_QUADS_PER_MESH - 1) is not the
    // global last event, so its gapNext must still be the real distance to the next neighbor.
    const gaps = computeChunkGaps(lanePairs(MAX_QUADS_PER_MESH + 1));
    const boundaryIdx = (MAX_QUADS_PER_MESH - 1) * 2;
    expect(gaps[boundaryIdx + 1]).toBe(5); // gapNext to event MAX_QUADS_PER_MESH
    expect(gaps[gaps.length - 1]).toBe(EDGE_GAP_F32); // only the true last event is an edge
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
