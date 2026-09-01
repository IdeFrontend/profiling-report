import { describe, expect, it } from 'vitest';
import {
  computeAltMeasureGap,
  eventMeasureTargetTime,
  rebuildLayout,
} from '../../src/swimlane/layout';
import type { SwimEvent, SwimlaneModel } from '../../src/domain/types';

function ev(id: string, startTime: number, duration: number): SwimEvent {
  return { id, name: id, startTime, duration };
}

function twoLaneModel(): SwimlaneModel {
  return {
    minTime: 0,
    maxTime: 2000,
    processes: [
      {
        id: 'p-1',
        name: 'P',
        threads: [
          {
            id: 't-1',
            name: 'Lane A',
            events: [ev('a', 100, 100)],
          },
          {
            id: 't-2',
            name: 'Lane B',
            events: [ev('b', 300, 100)],
          },
        ],
      },
    ],
  };
}

describe('eventMeasureTargetTime', () => {
  it('returns target start when target is after anchor', () => {
    expect(eventMeasureTargetTime(ev('a', 100, 100), ev('b', 250, 50))).toBe(250);
  });

  it('returns target end when target is before anchor', () => {
    expect(eventMeasureTargetTime(ev('b', 250, 50), ev('a', 100, 100))).toBe(200);
  });

  it('returns null when intervals overlap', () => {
    expect(eventMeasureTargetTime(ev('a', 100, 200), ev('b', 150, 50))).toBeNull();
  });

  it('returns null for same event', () => {
    const e = ev('a', 100, 100);
    expect(eventMeasureTargetTime(e, e)).toBeNull();
  });

  it('returns the touching edge time for adjacent events', () => {
    expect(eventMeasureTargetTime(ev('a', 100, 100), ev('b', 200, 50))).toBe(200);
    expect(eventMeasureTargetTime(ev('b', 200, 50), ev('a', 100, 100))).toBe(200);
  });
});

describe('computeAltMeasureGap', () => {
  it('computes same-lane gap when target follows anchor', () => {
    const layout = rebuildLayout({
      minTime: 0,
      maxTime: 1000,
      processes: [
        {
          id: 'p',
          name: 'P',
          threads: [
            {
              id: 't',
              name: 'T',
              events: [ev('a', 100, 100), ev('b', 250, 50)],
            },
          ],
        },
      ],
    });
    const gap = computeAltMeasureGap(layout, 'a', 250, 'b');
    expect(gap).toMatchObject({
      deltaNs: 50,
      anchorRefTime: 200,
      targetTime: 250,
      gapStartTime: 200,
      gapEndTime: 250,
      sameLane: true,
      targetEventId: 'b',
    });
  });

  it('computes cross-lane gap', () => {
    const layout = rebuildLayout(twoLaneModel());
    const gap = computeAltMeasureGap(layout, 'a', 300, 'b');
    expect(gap).toMatchObject({
      deltaNs: 100,
      gapStartTime: 200,
      gapEndTime: 300,
      sameLane: false,
    });
    expect(gap!.leftLaneY).not.toBe(gap!.rightLaneY);
  });

  it('returns null when target is inside the anchor span', () => {
    const layout = rebuildLayout({
      minTime: 0,
      maxTime: 1000,
      processes: [
        {
          id: 'p',
          name: 'P',
          threads: [{ id: 't', name: 'T', events: [ev('a', 100, 200)] }],
        },
      ],
    });
    expect(computeAltMeasureGap(layout, 'a', 150, null)).toBeNull();
  });

  it('returns null when touching (Δt = 0)', () => {
    const layout = rebuildLayout({
      minTime: 0,
      maxTime: 1000,
      processes: [
        {
          id: 'p',
          name: 'P',
          threads: [{ id: 't', name: 'T', events: [ev('a', 100, 100)] }],
        },
      ],
    });
    expect(computeAltMeasureGap(layout, 'a', 200, null)).toBeNull();
  });

  it('computes a cursor gap on the anchor lane when target has no event', () => {
    const layout = rebuildLayout(twoLaneModel());
    const gap = computeAltMeasureGap(layout, 'a', 350, null);
    expect(gap).toMatchObject({
      deltaNs: 150,
      anchorRefTime: 200,
      targetTime: 350,
      targetEventId: null,
    });
    expect(gap!.leftLaneY).toBe(gap!.rightLaneY);
  });
});
