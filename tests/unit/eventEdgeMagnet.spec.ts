import { describe, expect, it } from 'vitest';
import {
  LANE_GROUP_HEADER_HEIGHT,
  measureRangeExactEdgeMarks,
  nearestEventEdgeAtPoint,
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
  });
});
