import { describe, expect, it } from 'vitest';
import {
  collectLeafEventsFromModel,
  countLeafThreads,
  filterCollapsedTree,
  isFolderNode,
  walkVisibleRows,
} from '../../src/domain/swimTree';
import type { SwimlaneModel } from '../../src/domain/types';
import {
  contentHeightFromModel,
  LANE_GROUP_HEADER_HEIGHT,
  LANE_HEIGHT,
  rebuildLayout,
} from '../../src/swimlane/layout';

function nestedModel(): SwimlaneModel {
  return {
    minTime: 0,
    maxTime: 1000,
    processes: [
      {
        id: 'card0',
        name: 'Card0',
        threads: [
          { id: 'comm', name: '通信', events: [], utilization: 1 },
          {
            id: 'compute',
            name: '计算',
            events: [],
            utilization: 1,
            children: [
              {
                id: 'cube',
                name: 'Core0.Cube',
                events: [],
                utilization: 0.8,
                children: [
                  {
                    id: 'mte1',
                    name: 'MTE1',
                    utilization: 0.5,
                    events: [{ id: 'e1', name: 'busy', startTime: 0, duration: 10 }],
                  },
                ],
              },
              {
                id: 'vec0',
                name: 'Core0.Vec0',
                events: [],
                utilization: 0.7,
                children: [
                  {
                    id: 'scalar',
                    name: 'SCALAR',
                    events: [{ id: 'e2', name: 'busy', startTime: 0, duration: 5 }],
                  },
                ],
              },
            ],
          },
          { id: 'hbm', name: '储存HBM', events: [], utilization: 0.4 },
        ],
      },
    ],
  };
}

describe('swimTree + nested layout', () => {
  it('isFolderNode uses children property presence', () => {
    expect(isFolderNode({ id: 'a', name: 'a', events: [], children: [] })).toBe(true);
    expect(isFolderNode({ id: 'b', name: 'b', events: [] })).toBe(false);
  });

  it('filterCollapsedTree keeps folder row when nested id collapsed', () => {
    const filtered = filterCollapsedTree(nestedModel(), ['cube']);
    const compute = filtered.processes[0]!.threads[1]!;
    const cube = compute.children!.find((c) => c.id === 'cube')!;
    expect(isFolderNode(cube)).toBe(true);
    expect(cube.children).toEqual([]);
    expect(compute.children!.find((c) => c.id === 'vec0')!.children!.length).toBe(1);
  });

  it('walkVisibleRows / rebuildLayout: Card header + folder lanes + leaf events', () => {
    const model = nestedModel();
    const rows = walkVisibleRows(model);
    expect(rows.filter((r) => r.kind === 'header')).toHaveLength(1);
    expect(rows.filter((r) => r.kind === 'folder').map((r) => r.thread.name)).toEqual([
      '计算',
      'Core0.Cube',
      'Core0.Vec0',
    ]);
    expect(rows.filter((r) => r.kind === 'leaf').map((r) => r.thread.name)).toEqual([
      '通信',
      'MTE1',
      'SCALAR',
      '储存HBM',
    ]);

    const layout = rebuildLayout(model);
    expect(layout.headers[0]).toMatchObject({ id: 'card0', name: 'Card0', y: 0 });
    expect(layout.events.map((e) => e.id).sort()).toEqual(['e1', 'e2']);
    expect(layout.lanes.some((l) => l.folder && l.thread.name === '计算')).toBe(true);
    expect(layout.lanes.find((l) => l.thread.id === 'mte1')?.folder).toBeFalsy();

    // 1 header + 3 folders + 4 leaves
    expect(contentHeightFromModel(model)).toBe(
      LANE_GROUP_HEADER_HEIGHT + 7 * LANE_HEIGHT,
    );
  });

  it('collectLeafEventsFromModel skips folders and spacers without events', () => {
    const events = collectLeafEventsFromModel(nestedModel());
    expect(events.map((e) => e.id).sort()).toEqual(['e1', 'e2']);
    expect(countLeafThreads(nestedModel().processes[0]!.threads)).toBe(4);
  });
});
