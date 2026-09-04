import { describe, expect, it } from 'vitest';
import { MAX_QUADS_PER_MESH } from '../../src/swimlane/layout';
import {
  EDGE_GAP,
  eventGaps,
  setVbSquareWithGaps,
} from '../../src/swimlane/WebGlSwimlaneRenderer';
import { extendMargin1Css, extendMargin2Css, extendTargetSizeCss } from '../../src/swimlane/shaders';

/** `n` non-overlapping events: start = i*10, end = i*10+5, so every interior gap is 5. */
function lanePairs(n: number): number[] {
  const pairs: number[] = [];
  for (let i = 0; i < n; i++) pairs.push(i * 10, i * 10 + 5);
  return pairs;
}

describe('eventGaps', () => {
  it('PR-RENDER-024: a single event is an edge on both sides', () => {
    expect(eventGaps([10, 15], 0)).toEqual([EDGE_GAP, EDGE_GAP]);
  });

  it('PR-RENDER-024: an interior event reads exact neighbors on both sides', () => {
    // [0,5], [20,25], [40,45]: gapPrev = 20-5 = 15, gapNext = 40-25 = 15.
    expect(eventGaps([0, 5, 20, 25, 40, 45], 1)).toEqual([15, 15]);
  });

  it('PR-RENDER-024: lane boundary events use EDGE_GAP only on their boundary side', () => {
    const pairs = lanePairs(3);
    expect(eventGaps(pairs, 0)).toEqual([EDGE_GAP, 5]); // first: fake prev, real next
    expect(eventGaps(pairs, 2)).toEqual([5, EDGE_GAP]); // last: real prev, fake next
  });

  it('PR-RENDER-024: chunk-split events read real neighbors across the boundary, both directions', () => {
    // MAX_QUADS_PER_MESH + 2 events: chunk 1 = indices 0..MAX_QUADS_PER_MESH-1,
    // chunk 2 = indices MAX_QUADS_PER_MESH .. MAX_QUADS_PER_MESH+1.
    const pairs = lanePairs(MAX_QUADS_PER_MESH + 2);
    // Last event of chunk 1: gapNext is the real distance to chunk 2's first event (not EDGE_GAP).
    expect(eventGaps(pairs, MAX_QUADS_PER_MESH - 1)).toEqual([5, 5]);
    // First event of chunk 2: gapPrev is the real distance back into chunk 1's last event
    // (not EDGE_GAP), and gapNext is real since it is not the lane's last event.
    expect(eventGaps(pairs, MAX_QUADS_PER_MESH)).toEqual([5, 5]);
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
