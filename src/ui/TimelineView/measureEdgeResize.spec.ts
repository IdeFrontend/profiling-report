import { describe, expect, it } from 'vitest';
import { measureResizeMinSpan, resizeMeasureEdge } from './measureEdgeResize';

describe('measureEdgeResize', () => {
  it('measureResizeMinSpan is at least 1 and scales with view/px', () => {
    expect(measureResizeMinSpan(0, 1000, 400)).toBe(1000 / 400);
    expect(measureResizeMinSpan(0, 10, 1000)).toBe(1);
  });

  it('left edge moves start and keeps end fixed', () => {
    expect(
      resizeMeasureEdge({
        edge: 'left',
        time: 250,
        fixedOther: 500,
        viewStart: 0,
        viewEnd: 1000,
        minSpan: 1,
      }),
    ).toEqual({ startTime: 250, endTime: 500 });
  });

  it('right edge moves end and keeps start fixed', () => {
    expect(
      resizeMeasureEdge({
        edge: 'right',
        time: 700,
        fixedOther: 200,
        viewStart: 0,
        viewEnd: 1000,
        minSpan: 1,
      }),
    ).toEqual({ startTime: 200, endTime: 700 });
  });

  it('left edge cannot cross right minus minSpan', () => {
    expect(
      resizeMeasureEdge({
        edge: 'left',
        time: 900,
        fixedOther: 500,
        viewStart: 0,
        viewEnd: 1000,
        minSpan: 10,
      }),
    ).toEqual({ startTime: 490, endTime: 500 });
  });

  it('clamps moving edge into the view window', () => {
    expect(
      resizeMeasureEdge({
        edge: 'right',
        time: 2000,
        fixedOther: 200,
        viewStart: 0,
        viewEnd: 1000,
        minSpan: 1,
      }),
    ).toEqual({ startTime: 200, endTime: 1000 });
  });
});
