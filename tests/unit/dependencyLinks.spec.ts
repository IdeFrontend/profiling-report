import { describe, expect, it } from 'vitest';
import type { SwimEvent, SwimlaneModel } from '../../src/domain/types';
import { cubicLinkPath, dependencyLinkPaths } from '../../src/swimlane/dependencyLinks';
import { eventBlockMetrics, rebuildLayout } from '../../src/swimlane/layout';

function linkedModel(): SwimlaneModel {
  const parent: SwimEvent = {
    id: 'e-parent',
    name: 'parent',
    startTime: 0,
    duration: 40,
    dependencies: {
      predecessors: [],
      successors: [{ tid: 't-b', index: 0 }],
    },
  };
  const child: SwimEvent = {
    id: 'e-child',
    name: 'child',
    startTime: 50,
    duration: 10,
    dependencies: {
      predecessors: [{ tid: 't-a', index: 0 }],
      successors: [],
    },
  };
  return {
    minTime: 0,
    maxTime: 100,
    processes: [
      {
        id: 'p-1',
        name: 'P',
        threads: [
          { id: 't-a', name: 'A', events: [parent] },
          { id: 't-b', name: 'B', events: [child] },
        ],
      },
    ],
  };
}

describe('PR-DEPS: dependency link paths', () => {
  it('PR-DEPS-001: selected event with deps yields predecessor and successor curves', () => {
    const model = linkedModel();
    const layout = rebuildLayout(model);
    const view = { startTime: 0, endTime: 100, scrollY: 0 };
    const width = 400;

    const fromParent = dependencyLinkPaths(layout, view, width, 'e-parent');
    const fromChild = dependencyLinkPaths(layout, view, width, 'e-child');
    expect(fromParent).toHaveLength(1);
    expect(fromChild).toHaveLength(1);

    const parentLaneY = layout.lanes[0]!.y;
    const childLaneY = layout.lanes[1]!.y;
    const parentMid = eventBlockMetrics(parentLaneY, 0);
    const childMid = eventBlockMetrics(childLaneY, 0);
    const expected = cubicLinkPath(
      160,
      parentMid.y + parentMid.h / 2,
      200,
      childMid.y + childMid.h / 2,
    );
    expect(fromParent[0]).toBe(expected);
    expect(fromChild[0]).toBe(expected);
  });

  it('PR-DEPS-002: no selection or empty deps yields no paths', () => {
    const model = linkedModel();
    model.processes[0]!.threads[0]!.events.push({
      id: 'e-plain',
      name: 'plain',
      startTime: 80,
      duration: 5,
    });
    const layout = rebuildLayout(model);
    const view = { startTime: 0, endTime: 100, scrollY: 0 };
    expect(dependencyLinkPaths(layout, view, 400, null)).toEqual([]);
    expect(dependencyLinkPaths(layout, view, 400, 'e-plain')).toEqual([]);
    expect(dependencyLinkPaths(layout, view, 0, 'e-parent')).toEqual([]);
    const orphan = linkedModel();
    orphan.processes[0]!.threads[0]!.events[0]!.dependencies!.successors = [{ tid: 'missing', index: 0 }];
    expect(dependencyLinkPaths(rebuildLayout(orphan), view, 400, 'e-parent')).toEqual([]);
  });
});
