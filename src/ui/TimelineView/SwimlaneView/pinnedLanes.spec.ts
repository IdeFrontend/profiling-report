import { describe, expect, it } from 'vitest';
import { filterCollapsedTree } from '../../../domain/swimTree';
import type { SwimlaneModel } from '../../../domain/types';
import { buildPinnedSwimModel } from './pinnedLanes';

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

describe('pinnedLanes', () => {
  it('buildPinnedSwimModel needs the unfiltered swim tree under Card collapse', () => {
    const display = filterCollapsedTree(fullModel, ['card0']);
    expect(buildPinnedSwimModel(display, ['scalar'])).toBeNull();

    const pinned = buildPinnedSwimModel(fullModel, ['scalar']);
    expect(pinned).not.toBeNull();
    expect(pinned!.processes[0]!.threads.map((t) => t.id)).toEqual(['scalar']);
    expect(pinned!.skipCardHeaders).toBe(true);
  });
});
