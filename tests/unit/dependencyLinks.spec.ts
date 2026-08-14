import { describe, expect, it, vi } from 'vitest';
import type { SwimEvent, SwimlaneModel } from '../../src/domain/types';
import { colorForThread } from '../../src/domain/laneColors';
import { CanvasSwimlaneRenderer, SwimlaneOverlayPainter } from '../../src/swimlane/CanvasSwimlaneRenderer';
import * as depLinks from '../../src/swimlane/dependencyLinks';
import {
  cubicControlPull,
  dependencyLinks,
  dependencyNeighborIds,
  glLinkTime,
  linkToScreen,
} from '../../src/swimlane/dependencyLinks';
import { eventBlockMetrics, eventLinkContentY, rebuildLayout } from '../../src/swimlane/layout';
import { WebGlSwimlaneRenderer } from '../../src/swimlane/WebGlSwimlaneRenderer';

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
          { id: 't-a', name: 'CUBE', events: [parent] },
          { id: 't-b', name: 'SCALAR', events: [child] },
        ],
      },
    ],
  };
}

describe('PR-DEPS: dependency links', () => {
  it('PR-DEPS-001: selected event with deps yields predecessor and successor curves', () => {
    const layout = rebuildLayout(linkedModel());
    expect(layout.eventsById.get('e-parent')).toBe(layout.events.find((e) => e.id === 'e-parent'));
    expect(layout.lanesByTid.get('t-a')).toBe(layout.lanes[0]);
    expect(layout.lanesByTid.get('t-b')).toBe(layout.lanes[1]);
    const view = { startTime: 0, endTime: 100, scrollY: 0 };
    const fromParent = dependencyLinks(layout, 'e-parent');
    const fromChild = dependencyLinks(layout, 'e-child');
    expect(fromParent).toHaveLength(1);
    expect(fromChild).toHaveLength(1);

    const parentMid = eventBlockMetrics(layout.lanes[0]!.y, 0);
    const childMid = eventBlockMetrics(layout.lanes[1]!.y, 0);
    expect(fromParent[0]).toMatchObject({
      t0: 40,
      t1: 50,
      y0: eventLinkContentY(layout.lanes[0]!.y),
      y1: eventLinkContentY(layout.lanes[1]!.y),
      fromColor: colorForThread('CUBE'),
      toColor: colorForThread('SCALAR'),
    });
    expect(fromParent[0]!.y0).toBe(parentMid.y + parentMid.h / 2);
    expect(fromParent[0]!.y1).toBe(childMid.y + childMid.h / 2);
    expect(fromChild[0]).toEqual(fromParent[0]);

    const screen = linkToScreen(fromParent[0]!, view, 400);
    expect(screen.x0).toBe(160);
    expect(screen.x1).toBe(200);
    expect(cubicControlPull(160, 200)).toBe(24);

    const base = 1_000_000_000_000;
    const t0 = glLinkTime(base + 40, base);
    const t1 = glLinkTime(base + 50, base);
    const v0 = glLinkTime(base, base);
    const v1 = glLinkTime(base + 100, base);
    expect(t1).toBeGreaterThan(t0);
    expect(((t0 - v0) / (v1 - v0)) * 400).toBeCloseTo(160);
    expect(((t1 - v0) / (v1 - v0)) * 400).toBeCloseTo(200);
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
    expect(dependencyLinks(layout, null)).toEqual([]);
    expect(dependencyLinks(layout, 'e-plain')).toEqual([]);
    const orphan = linkedModel();
    orphan.processes[0]!.threads[0]!.events[0]!.dependencies!.successors = [{ tid: 'missing', index: 0 }];
    expect(dependencyLinks(rebuildLayout(orphan), 'e-parent')).toEqual([]);
  });

  it('PR-DEPS-003: Canvas and WebGL paint selected dependency curves without throw', () => {
    const model = linkedModel();
    const canvas = document.createElement('canvas');
    const renderer = new CanvasSwimlaneRenderer();
    renderer.attach(canvas);
    renderer.resize(400, 120);
    renderer.setModel(model);
    renderer.setView({ startTime: 0, endTime: 100, scrollY: 0 });
    renderer.setSelection('e-parent', null);
    expect(() => renderer.render()).not.toThrow();

    const glCanvas = document.createElement('canvas');
    if (!WebGlSwimlaneRenderer.isSupported(glCanvas)) {
      expect(WebGlSwimlaneRenderer.isSupported(glCanvas)).toBe(false);
      return;
    }
    const gl = new WebGlSwimlaneRenderer();
    expect(gl.attach(glCanvas)).toBe(true);
    gl.resize(400, 120);
    gl.setModel(model);
    gl.setView({ startTime: 0, endTime: 100, scrollY: 0 });
    gl.setSelection('e-parent', null);
    expect(() => gl.render()).not.toThrow();
    gl.dispose();
  });

  it('PR-DEPS-004: each curve gradient runs from predecessor fill to successor fill', () => {
    const layout = rebuildLayout(linkedModel());
    const link = dependencyLinks(layout, 'e-parent')[0]!;
    expect(link.fromColor).toBe(colorForThread('CUBE'));
    expect(link.toColor).toBe(colorForThread('SCALAR'));
    expect(link.fromColor).not.toBe(link.toColor);
  });

  it('PR-DEPS-005: dependencyMode filters predecessor vs successor curves and neighbors', () => {
    const pred: SwimEvent = {
      id: 'e-pred',
      name: 'pred',
      startTime: 0,
      duration: 20,
      dependencies: { predecessors: [], successors: [{ tid: 't-hub', index: 0 }] },
    };
    const hub: SwimEvent = {
      id: 'e-hub',
      name: 'hub',
      startTime: 30,
      duration: 20,
      dependencies: {
        predecessors: [{ tid: 't-pred', index: 0 }],
        successors: [{ tid: 't-succ', index: 0 }],
      },
    };
    const succ: SwimEvent = {
      id: 'e-succ',
      name: 'succ',
      startTime: 60,
      duration: 20,
      dependencies: { predecessors: [{ tid: 't-hub', index: 0 }], successors: [] },
    };
    const layout = rebuildLayout({
      minTime: 0,
      maxTime: 100,
      processes: [
        {
          id: 'p-1',
          name: 'P',
          threads: [
            { id: 't-pred', name: 'CUBE', events: [pred] },
            { id: 't-hub', name: 'SCALAR', events: [hub] },
            { id: 't-succ', name: 'MTE', events: [succ] },
          ],
        },
      ],
    });

    expect(dependencyLinks(layout, 'e-hub', 'all')).toHaveLength(2);
    const predOnly = dependencyLinks(layout, 'e-hub', 'predecessors');
    expect(predOnly).toHaveLength(1);
    expect(predOnly[0]).toMatchObject({ t0: 20, t1: 30 });
    const succOnly = dependencyLinks(layout, 'e-hub', 'successors');
    expect(succOnly).toHaveLength(1);
    expect(succOnly[0]).toMatchObject({ t0: 50, t1: 60 });

    expect([...dependencyNeighborIds(layout, 'e-hub', 'predecessors')].sort()).toEqual([
      'e-hub',
      'e-pred',
    ]);
    expect([...dependencyNeighborIds(layout, 'e-hub', 'successors')].sort()).toEqual([
      'e-hub',
      'e-succ',
    ]);
  });

  it('PR-DEPS-001: overlay neighbor set rebuilds only on layout identity or selectedId change', () => {
    const spy = vi.spyOn(depLinks, 'dependencyNeighborIds');
    const layout = rebuildLayout(linkedModel());
    const overlay = new SwimlaneOverlayPainter();
    overlay.setLayout(layout);
    overlay.setSelection('e-parent', null);
    spy.mockClear();

    overlay.setLayout(layout);
    overlay.setSelection('e-parent', 'e-child');
    expect(spy).not.toHaveBeenCalled();

    overlay.setSelection('e-child', null);
    expect(spy).toHaveBeenCalledTimes(1);

    overlay.setLayout(rebuildLayout(linkedModel()));
    expect(spy).toHaveBeenCalledTimes(2);

    overlay.setDependencyMode('predecessors');
    expect(spy).toHaveBeenCalledTimes(3);
    overlay.setDependencyMode('predecessors');
    expect(spy).toHaveBeenCalledTimes(3);
    spy.mockRestore();
  });
});
