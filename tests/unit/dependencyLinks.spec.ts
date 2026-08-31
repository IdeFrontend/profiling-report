import { describe, expect, it, vi } from 'vitest';
import type { SwimEvent, SwimlaneModel } from '../../src/domain/types';
import { colorForThread } from '../../src/domain/laneColors';
import { CanvasSwimlaneRenderer, SwimlaneOverlayPainter } from '../../src/swimlane/CanvasSwimlaneRenderer';
import * as depLinks from '../../src/swimlane/dependencyLinks';
import {
  cubicControlPull,
  dependencyGraph,
  glLinkTime,
  linkIntersectsTimeView,
  linkToScreen,
  MAX_DEPENDENCY_LINKS,
} from '../../src/swimlane/dependencyLinks';
import { eventBlockMetrics, eventLinkContentY, rebuildLayout } from '../../src/swimlane/layout';
import { CURVE_VS } from '../../src/swimlane/shaders';
import { WebGlSwimlaneRenderer } from '../../src/swimlane/WebGlSwimlaneRenderer';

const hasWebGl2 = WebGlSwimlaneRenderer.isSupported();

function graphLinks(
  ...args: Parameters<typeof dependencyGraph>
): ReturnType<typeof dependencyGraph>['links'] {
  return dependencyGraph(...args).links;
}

function graphIds(...args: Parameters<typeof dependencyGraph>): Set<string> {
  return dependencyGraph(...args).ids;
}

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
    const fromParent = graphLinks(layout, 'e-parent');
    const fromChild = graphLinks(layout, 'e-child');
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

  it('PR-DEPS-011: overlapping async flow keeps pred-right → succ-left when t0 > t1', () => {
    const parent: SwimEvent = {
      id: 'e-parent',
      name: 'parent',
      startTime: 0,
      duration: 1_000_000,
      dependencies: { predecessors: [], successors: [{ tid: 't-b', index: 0 }] },
    };
    const worker: SwimEvent = {
      id: 'e-worker',
      name: 'worker',
      startTime: 100_000,
      duration: 50_000,
      dependencies: { predecessors: [{ tid: 't-a', index: 0 }], successors: [] },
    };
    const layout = rebuildLayout({
      minTime: 0,
      maxTime: 1_000_000,
      processes: [
        {
          id: 'p-1',
          name: 'P',
          threads: [
            { id: 't-a', name: 'CUBE', events: [parent] },
            { id: 't-b', name: 'SCALAR', events: [worker] },
          ],
        },
      ],
    });
    const link = graphLinks(layout, 'e-parent')[0]!;
    expect(link).toMatchObject({
      t0: 1_000_000,
      t1: 100_000,
      fromColor: colorForThread('CUBE'),
      toColor: colorForThread('SCALAR'),
    });
    const view = { startTime: 0, endTime: 1_000_000, scrollY: 0 };
    const { x0, x1 } = linkToScreen(link, view, 400);
    expect(x0).toBeGreaterThan(x1);
    const pull = cubicControlPull(x0, x1);
    expect(pull).toBeLessThan(0);
    expect(x0 + pull).toBeLessThan(x0);
    expect(x1 - pull).toBeGreaterThan(x1);
    expect(CURVE_VS).toMatch(/p1\.x >= p0\.x \? mag : -mag/);
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
    expect(graphLinks(layout, null)).toEqual([]);
    expect(graphLinks(layout, 'e-plain')).toEqual([]);
    const orphan = linkedModel();
    orphan.processes[0]!.threads[0]!.events[0]!.dependencies!.successors = [{ tid: 'missing', index: 0 }];
    expect(graphLinks(rebuildLayout(orphan), 'e-parent')).toEqual([]);
  });

  it('PR-DEPS-003: Canvas paints selected dependency curves without throw', () => {
    const model = linkedModel();
    const canvas = document.createElement('canvas');
    const renderer = new CanvasSwimlaneRenderer();
    renderer.attach(canvas);
    renderer.resize(400, 120, 1);
    renderer.setModel(model);
    renderer.setView({ startTime: 0, endTime: 100, scrollY: 0 });
    renderer.setSelection('e-parent', null);
    expect(() => renderer.render()).not.toThrow();
    renderer.dispose();
  });

  // jsdom: getContext('webgl2') is null. Chromium coverage is PR-E2E-007.
  it.skipIf(!hasWebGl2)('PR-DEPS-003: WebGL paints selected dependency curves without throw', () => {
    const glCanvas = document.createElement('canvas');
    const gl = new WebGlSwimlaneRenderer();
    expect(gl.attach(glCanvas)).toBe(true);
    gl.resize(400, 120, 1);
    gl.setModel(linkedModel());
    gl.setView({ startTime: 0, endTime: 100, scrollY: 0 });
    gl.setSelection('e-parent', null);
    expect(() => gl.render()).not.toThrow();
    gl.dispose();
  });

  it('PR-DEPS-004: each curve gradient runs from predecessor fill to successor fill', () => {
    const layout = rebuildLayout(linkedModel());
    const link = graphLinks(layout, 'e-parent')[0]!;
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

    expect(graphLinks(layout, 'e-hub', 'all')).toHaveLength(2);
    const predOnly = graphLinks(layout, 'e-hub', 'predecessors');
    expect(predOnly).toHaveLength(1);
    expect(predOnly[0]).toMatchObject({ t0: 20, t1: 30 });
    const succOnly = graphLinks(layout, 'e-hub', 'successors');
    expect(succOnly).toHaveLength(1);
    expect(succOnly[0]).toMatchObject({ t0: 50, t1: 60 });

    expect([...graphIds(layout, 'e-hub', 'predecessors')].sort()).toEqual([
      'e-hub',
      'e-pred',
    ]);
    expect([...graphIds(layout, 'e-hub', 'successors')].sort()).toEqual([
      'e-hub',
      'e-succ',
    ]);
  });

  it('PR-DEPS-010: overlay uses renderer neighbor ids and does not walk the graph', () => {
    const graphSpy = vi.spyOn(depLinks, 'dependencyGraph');
    const overlay = new SwimlaneOverlayPainter();
    overlay.setLayout(rebuildLayout(linkedModel()));
    overlay.setSelection('e-parent', null);
    overlay.setNeighborIds(new Set(['e-parent', 'e-child']));
    overlay.setSearchQuery('p');
    overlay.setLayout(rebuildLayout(linkedModel()));
    overlay.setSelection('e-child', 'e-parent');
    expect(graphSpy).not.toHaveBeenCalled();
    graphSpy.mockRestore();
  });

  it.skipIf(!hasWebGl2)('PR-DEPS-010: WebGL overlay reuses cached neighbor ids', () => {
    const overlay = new SwimlaneOverlayPainter();
    const glCanvas = document.createElement('canvas');
    const glGraph = vi.spyOn(depLinks, 'dependencyGraph');
    const gl = new WebGlSwimlaneRenderer();
    expect(gl.attach(glCanvas)).toBe(true);
    gl.resize(400, 120, 1);
    gl.setModel(linkedModel());
    gl.setSelection('e-parent', null);
    overlay.setLayout(gl.getLayout());
    overlay.setSelection('e-parent', null);
    overlay.setNeighborIds(gl.getNeighborIds());
    glGraph.mockClear();

    overlay.setSelection('e-parent', 'e-child');
    overlay.setSearchQuery('parent');
    expect(glGraph).not.toHaveBeenCalled();

    gl.setSelection('e-child', null);
    overlay.setSelection('e-child', null);
    overlay.setNeighborIds(gl.getNeighborIds());
    expect(glGraph).toHaveBeenCalledTimes(1);
    gl.dispose();
    glGraph.mockRestore();
  });

  it('PR-DEPS-008: Canvas fallback does not recompute dependency graph on pan', () => {
    const graphSpy = vi.spyOn(depLinks, 'dependencyGraph');
    const canvas = document.createElement('canvas');
    const renderer = new CanvasSwimlaneRenderer();
    renderer.attach(canvas);
    renderer.resize(400, 120, 1);
    renderer.setModel(linkedModel());
    renderer.setView({ startTime: 0, endTime: 100, scrollY: 0 });
    renderer.setSelection('e-parent', null);
    graphSpy.mockClear();

    renderer.render();
    renderer.setView({ startTime: 10, endTime: 110, scrollY: 0 });
    renderer.render();
    expect(graphSpy).not.toHaveBeenCalled();

    renderer.setSelection('e-child', null);
    expect(graphSpy).toHaveBeenCalledTimes(1);
    renderer.dispose();
    graphSpy.mockRestore();
  });

  it.skipIf(!hasWebGl2)('PR-DEPS-009: WebGL does not recompute dependency graph on search', () => {
    const graphSpy = vi.spyOn(depLinks, 'dependencyGraph');
    const gl = new WebGlSwimlaneRenderer();
    expect(gl.attach(document.createElement('canvas'))).toBe(true);
    gl.resize(400, 120, 1);
    gl.setModel(linkedModel());
    gl.setSelection('e-parent', null);
    graphSpy.mockClear();

    gl.setSearchQuery('parent');
    gl.setSearchQuery('p');
    expect(graphSpy).not.toHaveBeenCalled();

    gl.setSelection('e-child', null);
    expect(graphSpy).toHaveBeenCalledTimes(1);
    gl.dispose();
    graphSpy.mockRestore();
  });

  it('PR-DEPS-006: depth n draws n hops; -1 has no hop cap; 0 draws none', () => {
    function ev(
      id: string,
      start: number,
      predTid: string | null,
      succTid: string | null,
    ): SwimEvent {
      return {
        id,
        name: id,
        startTime: start,
        duration: 10,
        dependencies: {
          predecessors: predTid ? [{ tid: predTid, index: 0 }] : [],
          successors: succTid ? [{ tid: succTid, index: 0 }] : [],
        },
      };
    }
    const layout = rebuildLayout({
      minTime: 0,
      maxTime: 100,
      processes: [
        {
          id: 'p-1',
          name: 'P',
          threads: [
            { id: 't-z', name: 'CUBE', events: [ev('e-z', 0, null, 't-a')] },
            { id: 't-a', name: 'SCALAR', events: [ev('e-a', 20, 't-z', 't-b')] },
            { id: 't-b', name: 'MTE', events: [ev('e-b', 40, 't-a', 't-c')] },
            { id: 't-c', name: 'FIX', events: [ev('e-c', 60, 't-b', null)] },
          ],
        },
      ],
    });

    expect(graphLinks(layout, 'e-b', 'all', 1)).toHaveLength(2);
    expect(graphLinks(layout, 'e-b', 'all', 2).map((l) => [l.t0, l.t1])).toEqual(
      expect.arrayContaining([
        [10, 20],
        [30, 40],
        [50, 60],
      ]),
    );
    expect(graphLinks(layout, 'e-b', 'all', 2)).toHaveLength(3);
    expect(graphLinks(layout, 'e-a', 'successors', 1)).toHaveLength(1);
    expect(graphLinks(layout, 'e-a', 'successors', 2)).toHaveLength(2);
    expect(graphLinks(layout, 'e-a', 'successors', -1)).toHaveLength(2);
    expect(graphLinks(layout, 'e-b', 'all', 0)).toEqual([]);
    expect([...graphIds(layout, 'e-b', 'all', 0)]).toEqual(['e-b']);
    expect([...graphIds(layout, 'e-a', 'successors', 2)].sort()).toEqual([
      'e-a',
      'e-b',
      'e-c',
    ]);
  });

  it('PR-DEPS-007: each side stops after MAX_DEPENDENCY_LINKS', () => {
    const n = MAX_DEPENDENCY_LINKS + 2;
    const events: SwimEvent[] = [];
    for (let i = 0; i < n; i++) {
      events.push({
        id: `e-${i}`,
        name: `e-${i}`,
        startTime: i * 10,
        duration: 5,
        dependencies: {
          predecessors: i > 0 ? [{ tid: 't', index: i - 1 }] : [],
          successors: i < n - 1 ? [{ tid: 't', index: i + 1 }] : [],
        },
      });
    }
    const layout = rebuildLayout({
      minTime: 0,
      maxTime: n * 10,
      processes: [{ id: 'p', name: 'P', threads: [{ id: 't', name: 'CUBE', events }] }],
    });
    const links = graphLinks(layout, 'e-0', 'successors', -1);
    expect(links).toHaveLength(MAX_DEPENDENCY_LINKS);
    expect(n - 1).toBeGreaterThan(MAX_DEPENDENCY_LINKS);

    const inView = { t0: 10, t1: 20, y0: 0, y1: 0, fromColor: '#000', toColor: '#000' };
    expect(linkIntersectsTimeView(inView, { startTime: 0, endTime: 100, scrollY: 0 })).toBe(true);
    expect(linkIntersectsTimeView(inView, { startTime: 50, endTime: 100, scrollY: 0 })).toBe(false);
    expect(linkIntersectsTimeView(inView, { startTime: 15, endTime: 18, scrollY: 0 })).toBe(true);
  });

  it('PR-DEPS-012: no dependency curves painted in the pinned-lane strip pass', () => {
    const model = linkedModel();
    const renderer = new CanvasSwimlaneRenderer();
    renderer.attach(document.createElement('canvas'));
    renderer.resize(200, 100, 1);
    renderer.setModel(model);
    renderer.setSelection('e-parent', null);
    expect(renderer.getNeighborIds().size).toBeGreaterThan(0);
    renderer.setPaintDependencies(false);
    expect(renderer.getNeighborIds().size).toBe(0);
    renderer.render();
    // Re-enable restores graph for the main canvas pass.
    renderer.setPaintDependencies(true);
    expect(renderer.getNeighborIds().has('e-parent')).toBe(true);
  });
});
