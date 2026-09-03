import { describe, expect, it } from 'vitest';
import {
  collectLeafEventsFromModel,
  countLeafThreads,
  filterCollapsedTree,
  isComputeCategory,
  isFolderNode,
  nestCardTreeFromFlatCorePipes,
  unionEventIntervals,
  walkVisibleRows,
} from '../../src/domain/swimTree';
import type { SwimlaneModel } from '../../src/domain/types';
import {
  contentHeightFromModel,
  LANE_GROUP_HEADER_HEIGHT,
  LANE_HEIGHT,
  layoutHeaders,
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

  it('isComputeCategory prefers categoryKey over display name', () => {
    expect(isComputeCategory({ id: 'a', name: 'Compute', events: [], categoryKey: 'compute' })).toBe(
      true,
    );
    expect(isComputeCategory({ id: 'b', name: '计算', events: [] })).toBe(true);
    expect(isComputeCategory({ id: 'c', name: '通信', events: [], categoryKey: 'comm' })).toBe(false);
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
    expect(layoutHeaders(model)).toEqual(layout.headers);
    expect(layout.events.map((e) => e.id).sort()).toEqual(['e1', 'e2']);
    expect(layout.lanes.some((l) => l.folder && l.thread.name === '计算')).toBe(true);
    expect(layout.lanes.find((l) => l.thread.id === 'mte1')?.folder).toBeFalsy();

    // 1 header + 3 folders + 4 leaves
    expect(contentHeightFromModel(model)).toBe(
      LANE_GROUP_HEADER_HEIGHT + 7 * LANE_HEIGHT,
    );
  });

  it('skipCardHeaders omits Card header height and layout headers', () => {
    const model = { ...nestedModel(), skipCardHeaders: true as const };
    expect(contentHeightFromModel(model)).toBe(7 * LANE_HEIGHT);
    expect(rebuildLayout(model).headers).toEqual([]);
  });

  it('collectLeafEventsFromModel skips folders and spacers without events', () => {
    const events = collectLeafEventsFromModel(nestedModel());
    expect(events.map((e) => e.id).sort()).toEqual(['e1', 'e2']);
    expect(countLeafThreads(nestedModel().processes[0]!.threads)).toBe(4);
  });

  it('rebuildLayout carries no bands; folders still lay out as lanes', () => {
    const layout = rebuildLayout(nestedModel());
    expect('bands' in layout).toBe(false);
    expect(layout.lanes.filter((l) => l.folder).length).toBeGreaterThan(0);
  });

  it('unionEventIntervals merges overlapping and touching intervals into disjoint ranges', () => {
    const ev = (id: string, startTime: number, duration: number) => ({ id, name: id, startTime, duration });

    // Overlapping spans merge.
    expect(unionEventIntervals([ev('a', 0, 10), ev('b', 5, 10)])).toEqual([
      { startTime: 0, duration: 15 },
    ]);

    // Touching (end === next.start) merges into one span.
    expect(unionEventIntervals([ev('a', 0, 10), ev('b', 10, 5)])).toEqual([
      { startTime: 0, duration: 15 },
    ]);

    // Disjoint stays separate, sorted by start.
    expect(unionEventIntervals([ev('b', 20, 5), ev('a', 0, 10)])).toEqual([
      { startTime: 0, duration: 10 },
      { startTime: 20, duration: 5 },
    ]);

    expect(unionEventIntervals([])).toEqual([]);
  });

  it('PR-SWIM-014: collapsed folder carries disjoint-union summaryEvents; expanded omits', () => {
    const collapsed = filterCollapsedTree(nestedModel(), ['cube']);
    const compute = collapsed.processes[0]!.threads[1]!;
    const cube = compute.children!.find((c) => c.id === 'cube')!;
    expect(cube.summaryEvents).toEqual([
      { id: 'cube/summary/0', name: '', startTime: 0, duration: 10 },
    ]);
    // Expanded folder has no summary.
    const vec0 = compute.children!.find((c) => c.id === 'vec0')!;
    expect(vec0.summaryEvents).toBeUndefined();

    // Collapse the whole 计算 subtree: e1 (0..10) ∪ e2 (0..5) = 0..10.
    const computeCollapsed = filterCollapsedTree(nestedModel(), ['compute']);
    const c2 = computeCollapsed.processes[0]!.threads[1]!;
    expect(c2.summaryEvents).toEqual([
      { id: 'compute/summary/0', name: '', startTime: 0, duration: 10 },
    ]);
  });

  it('nestCardTreeFromFlatCorePipes builds Card → 计算 → Core → pipe', () => {
    const flat: SwimlaneModel = {
      minTime: 0,
      maxTime: 100,
      processes: [
        {
          id: '1',
          name: 'Card0',
          threads: [
            {
              id: 't-1-1',
              name: 'Core0.Cube/SCALAR',
              utilization: 0.8,
              events: [{ id: 'e1', name: 'op', startTime: 0, duration: 10 }],
            },
            {
              id: 't-1-2',
              name: 'Core0.Cube/MTE1',
              utilization: 0.4,
              events: [{ id: 'e2', name: 'op', startTime: 0, duration: 5 }],
            },
            {
              id: 't-1-3',
              name: 'Core0.Vec0/ALL',
              events: [{ id: 'e3', name: 'op', startTime: 0, duration: 5 }],
            },
          ],
        },
      ],
    };
    const nested = nestCardTreeFromFlatCorePipes(flat);
    expect(nested.processes[0]!.threads.map((t) => t.name)).toEqual(['通信', '计算', '储存HBM']);
    const compute = nested.processes[0]!.threads[1]!;
    expect(compute.children!.map((c) => c.name)).toEqual(['Core0.Cube', 'Core0.Vec0']);
    const cube = compute.children!.find((c) => c.name === 'Core0.Cube')!;
    expect(cube.children!.map((c) => c.name)).toEqual(['SCALAR', 'MTE1']);
    expect(cube.children!.map((c) => c.id)).toEqual(['t-1-1', 't-1-2']);
    expect(collectLeafEventsFromModel(nested).map((e) => e.id).sort()).toEqual(['e1', 'e2', 'e3']);
    expect(nested.metadata?.defaultCollapsedIds).toEqual(['1/Core0.Vec0']);
  });

  it('nestCardTreeFromFlatCorePipes no-ops on AIV pipe-state names', () => {
    const flat: SwimlaneModel = {
      minTime: 0,
      maxTime: 10,
      processes: [
        {
          id: '1',
          name: 'P',
          threads: [
            {
              id: 't-1-1',
              name: 'AIV0/PIPE_V/status',
              events: [{ id: 'e1', name: 'op', startTime: 0, duration: 1 }],
            },
          ],
        },
      ],
    };
    expect(nestCardTreeFromFlatCorePipes(flat)).toBe(flat);
  });
});
