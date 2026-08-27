import { describe, expect, it } from 'vitest';
import {
  computeEventMeasureGap,
  eventMeasureDeltaUs,
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

describe('eventMeasureDeltaUs', () => {
  it('returns gap when target is after anchor', () => {
    expect(eventMeasureDeltaUs(ev('a', 100, 100), ev('b', 250, 50))).toBe(50);
  });

  it('returns gap when target is before anchor', () => {
    expect(eventMeasureDeltaUs(ev('b', 250, 50), ev('a', 100, 100))).toBe(50);
  });

  it('returns null when intervals overlap', () => {
    expect(eventMeasureDeltaUs(ev('a', 100, 200), ev('b', 150, 50))).toBeNull();
  });

  it('returns null for same event', () => {
    const e = ev('a', 100, 100);
    expect(eventMeasureDeltaUs(e, e)).toBeNull();
  });
});

describe('computeEventMeasureGap', () => {
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
    const gap = computeEventMeasureGap(layout, 'a', 'b');
    expect(gap).toMatchObject({
      deltaUs: 50,
      gapStartTime: 200,
      gapEndTime: 250,
      sameLane: true,
    });
  });

  it('computes cross-lane gap', () => {
    const layout = rebuildLayout(twoLaneModel());
    const gap = computeEventMeasureGap(layout, 'a', 'b');
    expect(gap).toMatchObject({
      deltaUs: 100,
      gapStartTime: 200,
      gapEndTime: 300,
      sameLane: false,
    });
    expect(gap!.leftLaneY).not.toBe(gap!.rightLaneY);
  });

  it('returns null when overlapping', () => {
    const layout = rebuildLayout({
      minTime: 0,
      maxTime: 1000,
      processes: [
        {
          id: 'p',
          name: 'P',
          threads: [{ id: 't', name: 'T', events: [ev('a', 100, 200), ev('b', 150, 50)] }],
        },
      ],
    });
    expect(computeEventMeasureGap(layout, 'a', 'b')).toBeNull();
  });
});
