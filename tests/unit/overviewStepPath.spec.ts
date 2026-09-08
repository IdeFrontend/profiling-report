import { describe, expect, it } from 'vitest';
import { stepAfterVertices } from '../../src/ui/TimelineView/OverviewCharts/stepPath';

describe('stepAfterVertices', () => {
  it('PR-OV-004: holds prior value until next sample then jumps', () => {
    const verts = stepAfterVertices(
      [
        { t: 0, v: 0 },
        { t: 100, v: 50 },
        { t: 200, v: 25 },
      ],
      0,
      300,
    );
    expect(verts).toEqual([
      { t: 0, v: 0 },
      { t: 100, v: 0 },
      { t: 100, v: 50 },
      { t: 200, v: 50 },
      { t: 200, v: 25 },
      { t: 300, v: 25 },
    ]);
  });

  it('holds value from before the window into the visible range', () => {
    const verts = stepAfterVertices(
      [
        { t: 0, v: 10 },
        { t: 50, v: 80 },
        { t: 150, v: 20 },
      ],
      100,
      200,
    );
    expect(verts).toEqual([
      { t: 100, v: 80 },
      { t: 150, v: 80 },
      { t: 150, v: 20 },
      { t: 200, v: 20 },
    ]);
  });
});
