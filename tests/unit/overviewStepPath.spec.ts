import { describe, expect, it } from 'vitest';
import {
  stepAfterVertices,
  stepPointAt,
  stepValueAt,
} from '../../src/ui/TimelineView/OverviewCharts/stepPath';

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

describe('stepValueAt', () => {
  it('PR-OV-006: returns held step value at cursor time', () => {
    const pts = [
      { t: 0, v: 10 },
      { t: 100, v: 50 },
      { t: 200, v: 25 },
    ];
    expect(stepValueAt(pts, 50)).toBe(10);
    expect(stepValueAt(pts, 100)).toBe(50);
    expect(stepValueAt(pts, 150)).toBe(50);
    expect(stepValueAt(pts, -1)).toBeNull();
  });
});

describe('stepPointAt', () => {
  it('holds full sample including optional values snapshot', () => {
    const pts = [
      { t: 0, v: 2, values: { 'Utilization (%)': 2, 'Using Bytes (KB)': 0.05 } },
      { t: 100, v: 3, values: { 'Utilization (%)': 3, 'Using Bytes (KB)': 0.04 } },
    ];
    expect(stepPointAt(pts, 50)).toEqual(pts[0]);
    expect(stepPointAt(pts, 100)).toEqual(pts[1]);
    expect(stepPointAt(pts, 150)).toEqual(pts[1]);
    expect(stepPointAt(pts, -1)).toBeNull();
  });
});
