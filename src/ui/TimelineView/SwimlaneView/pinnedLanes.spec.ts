import { describe, expect, it } from 'vitest';
import { filterCollapsedTree } from '../../../domain/swimTree';
import type { SwimlaneModel } from '../../../domain/types';
import { buildPinnedSwimModel, resolvePinnedGutterLanes } from './pinnedLanes';

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

  it('resolvePinnedGutterLanes carries each Card utilMidlinePercent per row', () => {
    const rows = resolvePinnedGutterLanes(
      [
        {
          lanes: [{ id: 'a', name: 'A', color: '#f00', utilization: 0.5 }],
          utilMidlinePercent: 50,
        },
        {
          lanes: [{ id: 'b', name: 'B', color: '#0f0', bar: { barWidth: 80, label: '8µs' } }],
          utilMidlinePercent: 75,
        },
      ],
      ['b', 'a'],
    );
    expect(rows.map((r) => r.lane.id)).toEqual(['b', 'a']);
    expect(rows[0]!.utilMidlinePercent).toBe(75);
    expect(rows[1]!.utilMidlinePercent).toBe(50);
  });
});
