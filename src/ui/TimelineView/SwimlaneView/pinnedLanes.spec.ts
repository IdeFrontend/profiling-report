import { describe, expect, it } from 'vitest';
import { filterCollapsedTree } from '../../../domain/swimTree';
import type { SwimlaneModel } from '../../../domain/types';
import {
  buildPinnedSwimModel,
  countPinnedVisibleRows,
  resolvePinnedGutterRoots,
} from './pinnedLanes';

const fullModel: SwimlaneModel = {
  minTime: 0,
  maxTime: 1000,
  processes: [
    {
      id: 'card0',
      name: 'Card0',
      threads: [
        {
          id: 'cube',
          name: 'CUBE',
          events: [],
          children: [
            {
              id: 'scalar',
              name: 'SCALAR',
              events: [{ id: 'e1', name: 'op', startTime: 0, duration: 10 }],
            },
          ],
        },
      ],
    },
  ],
};

const groups = [
  {
    id: 'card0',
    name: 'Card0',
    lanes: [
      {
        id: 'cube',
        name: 'CUBE',
        color: '#f00',
        children: [{ id: 'scalar', name: 'SCALAR', color: '#0f0', utilization: 0.5 }],
      },
    ],
  },
];

describe('pinnedLanes', () => {
  it('buildPinnedSwimModel needs the unfiltered swim tree under Card collapse', () => {
    const display = filterCollapsedTree(fullModel, ['card0']);
    expect(buildPinnedSwimModel(display, ['scalar'])).toBeNull();

    const pinned = buildPinnedSwimModel(fullModel, ['scalar']);
    expect(pinned).not.toBeNull();
    expect(pinned!.processes[0]!.threads.map((t) => t.id)).toEqual(['scalar']);
    expect(pinned!.skipCardHeaders).toBe(true);
  });

  it('buildPinnedSwimModel clones a folder subtree when a folder id is pinned', () => {
    const pinned = buildPinnedSwimModel(fullModel, ['cube']);
    expect(pinned).not.toBeNull();
    const root = pinned!.processes[0]!.threads[0]!;
    expect(root.id).toBe('cube');
    expect(root.children?.map((c) => c.id)).toEqual(['scalar']);
  });

  it('buildPinnedSwimModel applies strip-local collapse without mutating the source', () => {
    const pinned = buildPinnedSwimModel(fullModel, ['cube'], ['cube']);
    expect(pinned!.processes[0]!.threads[0]!.children).toEqual([]);
    expect(fullModel.processes[0]!.threads[0]!.children?.length).toBe(1);
  });

  it('resolvePinnedGutterRoots returns depth-0 folder subtrees in pin order', () => {
    const roots = resolvePinnedGutterRoots(groups, ['cube']);
    expect(roots).toHaveLength(1);
    expect(roots[0]!.depth).toBe(0);
    expect(roots[0]!.lane.id).toBe('cube');
    expect(roots[0]!.lane.children?.map((c) => c.id)).toEqual(['scalar']);
  });

  it('countPinnedVisibleRows respects strip collapse', () => {
    const roots = resolvePinnedGutterRoots(groups, ['cube']);
    expect(countPinnedVisibleRows(roots)).toBe(2);
    expect(countPinnedVisibleRows(roots, ['cube'])).toBe(1);
  });
});
