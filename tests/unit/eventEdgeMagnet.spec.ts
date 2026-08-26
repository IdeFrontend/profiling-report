import { describe, expect, it } from 'vitest';
import {
  LANE_GROUP_HEADER_HEIGHT,
  LANE_HEIGHT,
  eventBlockMetrics,
  findExactEdgeMatches,
  findHoverGap,
  measureRangeExactEdgeMarks,
  nearestEventEdgeAtPoint,
  projectExactEdgeMarks,
  rebuildLayout,
} from '../../src/swimlane/layout';
import type { SwimlaneModel } from '../../src/domain/types';

function model(): SwimlaneModel {
  return {
    minTime: 0,
    maxTime: 1000,
    processes: [
      {
        id: 'p-1',
        name: 'P',
        threads: [
          {
            id: 't-1',
            name: 'T',
            events: [
              { id: 'e-long', name: 'long', startTime: 100, duration: 400 },
              { id: 'e-short', name: 'short', startTime: 100, duration: 50 },
              { id: 'e-right', name: 'right', startTime: 600, duration: 100 },
            ],
          },
        ],
      },
    ],
  };
}

describe('nearestEventEdgeAtPoint / measureRangeExactEdgeMarks', () => {
  const view = { startTime: 0, endTime: 1000, scrollY: 0 };
  const width = 1000; // 1px = 1 time unit
  const yLane = LANE_GROUP_HEADER_HEIGHT + 11;

  it('snaps to nearest start within threshold', () => {
    const layout = rebuildLayout(model());
    // e-long/e-short start at x=100; pointer at 105.
    const hit = nearestEventEdgeAtPoint(layout, view, width, 105, yLane, 10);
    expect(hit).toEqual({ time: 100, edge: 'start', eventId: expect.any(String), xPx: 100 });
    expect(hit!.time).toBe(100);
    expect(hit!.edge).toBe('start');
    expect(hit!.xPx).toBe(100);
  });

  it('snaps to end when closer than start', () => {
    const layout = rebuildLayout(model());
    // e-short end at 150; pointer at 148.
    const hit = nearestEventEdgeAtPoint(layout, view, width, 148, yLane, 10);
    expect(hit).toMatchObject({ time: 150, edge: 'end', eventId: 'e-short', xPx: 150 });
  });

  it('returns null outside threshold', () => {
    const layout = rebuildLayout(model());
    expect(nearestEventEdgeAtPoint(layout, view, width, 180, yLane, 10)).toBeNull();
  });

  it('returns null on group header (no leaf lane)', () => {
    const layout = rebuildLayout(model());
    expect(nearestEventEdgeAtPoint(layout, view, width, 100, 5, 10)).toBeNull();
  });

  it('prefers closer edge over shorter-duration event', () => {
    const layout = rebuildLayout(model());
    // Near e-long end (500), far from e-short end (150).
    const hit = nearestEventEdgeAtPoint(layout, view, width, 495, yLane, 10);
    expect(hit).toMatchObject({ time: 500, edge: 'end', eventId: 'e-long' });
  });

  it('measureRangeExactEdgeMarks highlights all events sharing a bound time', () => {
    const layout = rebuildLayout(model());
    const marks = measureRangeExactEdgeMarks(layout, view, width, 100, 500);
    const starts = marks.filter((m) => m.edge === 'start' && m.time === 100);
    expect(starts.map((m) => m.eventId).sort()).toEqual(['e-long', 'e-short']);
    const ends = marks.filter((m) => m.edge === 'end' && m.time === 500);
    expect(ends).toHaveLength(1);
    expect(ends[0]!.eventId).toBe('e-long');
    expect(ends[0]!.h).toBe(LANE_HEIGHT);
  });

  it('eventsByLane scopes magnet/hitTest to one lane without scanning all events', () => {
    const layout = rebuildLayout(model());
    expect(layout.eventsByLane).toHaveLength(layout.lanes.length);
    const leaf = layout.lanes.findIndex((l) => !l.folder);
    expect(leaf).toBeGreaterThanOrEqual(0);
    expect(layout.eventsByLane[leaf]!.every((e) => e.laneIndex === leaf)).toBe(true);
  });

  it('findExactEdgeMatches is view-invariant; projectExactEdgeMarks only moves x/y', () => {
    const layout = rebuildLayout(model());
    const matches = findExactEdgeMatches(layout, 100, 500);
    expect(matches.map((m) => `${m.eventId}:${m.edge}`).sort()).toEqual([
      'e-long:end',
      'e-long:start',
      'e-short:start',
    ]);
    const wide = projectExactEdgeMarks(matches, { startTime: 0, endTime: 1000, scrollY: 0 }, width);
    const zoomed = projectExactEdgeMarks(matches, { startTime: 0, endTime: 500, scrollY: 0 }, width);
    expect(wide.map((m) => `${m.eventId}:${m.edge}`).sort()).toEqual(
      zoomed.map((m) => `${m.eventId}:${m.edge}`).sort(),
    );
    expect(wide.find((m) => m.eventId === 'e-long' && m.edge === 'start')!.x).toBe(100);
    expect(zoomed.find((m) => m.eventId === 'e-long' && m.edge === 'start')!.x).toBe(200);
  });
});

describe('findHoverGap', () => {
  const view = { startTime: 0, endTime: 1000, scrollY: 0 };
  const width = 1000; // 1px = 1 time unit
  const yLane = LANE_GROUP_HEADER_HEIGHT + 11;

  function twoEventModel(): SwimlaneModel {
    return {
      minTime: 0,
      maxTime: 1000,
      processes: [
        {
          id: 'p-1',
          name: 'P',
          threads: [
            {
              id: 't-1',
              name: 'T',
              events: [
                { id: 'eA', name: 'a', startTime: 100, duration: 100 }, // ends 200
                { id: 'eB', name: 'b', startTime: 400, duration: 100 }, // ends 500
              ],
            },
          ],
        },
      ],
    };
  }

  it('returns the gap between adjacent events in the free middle', () => {
    const layout = rebuildLayout(twoEventModel());
    expect(findHoverGap(layout, view, width, 300, yLane, 10)).toEqual({
      leftEnd: 200,
      rightStart: 400,
      laneY: LANE_GROUP_HEADER_HEIGHT,
    });
  });

  it('returns null over an event block', () => {
    const layout = rebuildLayout(twoEventModel());
    expect(findHoverGap(layout, view, width, 150, yLane, 10)).toBeNull();
  });

  it('returns null in lane vertical padding above/below event blocks', () => {
    const layout = rebuildLayout(twoEventModel());
    const laneY = LANE_GROUP_HEADER_HEIGHT;
    const { y: blockY, h: blockH } = eventBlockMetrics(laneY, view.scrollY);
    const yAbove = blockY - 0.5;
    const yBelow = blockY + blockH + 0.5;
    // Horizontal gap between eA and eB — valid at block Y, not in lane padding.
    expect(findHoverGap(layout, view, width, 300, yAbove, 10)).toBeNull();
    expect(findHoverGap(layout, view, width, 300, yBelow, 10)).toBeNull();
    // Over an event in X but still in vertical padding.
    expect(findHoverGap(layout, view, width, 150, yAbove, 10)).toBeNull();
  });

  it('returns null within threshold of the left edge (magnet zone)', () => {
    const layout = rebuildLayout(twoEventModel());
    expect(findHoverGap(layout, view, width, 205, yLane, 10)).toBeNull();
  });

  it('returns null within threshold of the right edge (magnet zone)', () => {
    const layout = rebuildLayout(twoEventModel());
    expect(findHoverGap(layout, view, width, 395, yLane, 10)).toBeNull();
  });

  it('returns null on a group header / folder', () => {
    const layout = rebuildLayout(twoEventModel());
    expect(findHoverGap(layout, view, width, 300, 5, 10)).toBeNull();
  });

  it('returns null when no left neighbour brackets the pointer', () => {
    const layout = rebuildLayout(twoEventModel());
    expect(findHoverGap(layout, view, width, 50, yLane, 10)).toBeNull();
  });

  it('returns null when no right neighbour brackets the pointer', () => {
    const layout = rebuildLayout(twoEventModel());
    expect(findHoverGap(layout, view, width, 600, yLane, 10)).toBeNull();
  });

  it('returns null inside overlapping event intervals', () => {
    const m: SwimlaneModel = {
      minTime: 0,
      maxTime: 1000,
      processes: [
        {
          id: 'p-1',
          name: 'P',
          threads: [
            {
              id: 't-1',
              name: 'T',
              events: [
                { id: 'eA', name: 'a', startTime: 100, duration: 300 }, // 100..400
                { id: 'eB', name: 'b', startTime: 200, duration: 300 }, // 200..500
              ],
            },
          ],
        },
      ],
    };
    const layout = rebuildLayout(m);
    // 300 sits inside both blocks — tooltip wins, not a gap.
    expect(findHoverGap(layout, view, width, 300, yLane, 10)).toBeNull();
  });

  it('finds a gap before the first event with a large threshold does not shrink', () => {
    const layout = rebuildLayout(twoEventModel());
    // Free middle is unaffected by a larger magnet threshold beyond the band.
    expect(findHoverGap(layout, view, width, 300, yLane, 10)).toEqual({
      leftEnd: 200,
      rightStart: 400,
      laneY: LANE_GROUP_HEADER_HEIGHT,
    });
  });

  it('shows overlay in the middle of a sub-20px gap at high zoom', () => {
    const m: SwimlaneModel = {
      minTime: 0,
      maxTime: 10000,
      processes: [
        {
          id: 'p-1',
          name: 'P',
          threads: [
            {
              id: 't-1',
              name: 'T',
              events: [
                { id: 'eA', name: 'a', startTime: 6700, duration: 72 }, // ends 6772
                { id: 'eB', name: 'b', startTime: 6802, duration: 100 },
              ],
            },
          ],
        },
      ],
    };
    const layout = rebuildLayout(m);
    // 10 µs window → 30 ns gap ≈ 3.6 px at 1200 px width (matmul-like zoom).
    const zoomed = { startTime: 5000, endTime: 15000, scrollY: 0 };
    const w = 1200;
    const xMid = ((6787 - zoomed.startTime) / (zoomed.endTime - zoomed.startTime)) * w;
    expect(findHoverGap(layout, zoomed, w, xMid, yLane, 10)).toEqual({
      leftEnd: 6772,
      rightStart: 6802,
      laneY: LANE_GROUP_HEADER_HEIGHT,
    });
  });
});
