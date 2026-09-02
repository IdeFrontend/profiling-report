import { describe, expect, it } from 'vitest';
import { filterHiddenLanes } from './swimTree';
import type { SwimlaneModel } from './types';

const baseModel: SwimlaneModel = {
  processes: [
    {
      id: 'p1',
      name: 'P1',
      threads: [
        { id: 'leaf-A', name: 'A', events: [] },
        { id: 'leaf-B', name: 'B', events: [] },
        {
          id: 'folder-X',
          name: 'X',
          events: [],
          children: [
            { id: 'leaf-X1', name: 'X1', events: [] },
            { id: 'leaf-X2', name: 'X2', events: [] },
          ],
        },
      ],
    },
  ],
  minTime: 0,
  maxTime: 1,
};

describe('filterHiddenLanes', () => {
  it('returns the same model when no lanes are hidden', () => {
    expect(filterHiddenLanes(baseModel, [])).toBe(baseModel);
  });

  it('drops only the named leaves; folders and siblings stay', () => {
    const out = filterHiddenLanes(baseModel, ['leaf-A']);
    const p = out.processes[0];
    expect(p.threads.map((t) => t.id)).toEqual(['leaf-B', 'folder-X']);
    expect(p.threads[1].children?.map((c) => c.id)).toEqual(['leaf-X1', 'leaf-X2']);
  });

  it('is a no-op for ids that are not leaves (folder or unknown)', () => {
    const out = filterHiddenLanes(baseModel, ['folder-X', 'ghost']);
    // Object identity differs (filter re-wraps) but the contents match.
    expect(out).toStrictEqual(baseModel);
  });
});
