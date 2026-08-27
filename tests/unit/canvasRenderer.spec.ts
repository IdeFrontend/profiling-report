import { describe, expect, it } from 'vitest';
import {
  encodeIntervalPair,
  EVENT_MARGIN,
  eventEmphasisDim,
  eventLabelAnchor,
  eventPaintRect,
  eventRadius,
  hitTestLayout,
  rebuildLayout,
  snapCssPx,
  snapEventRect,
  LANE_GROUP_HEADER_HEIGHT,
  LANE_HEIGHT,
} from '../../src/swimlane/layout';
import { CanvasSwimlaneRenderer } from '../../src/swimlane/CanvasSwimlaneRenderer';
import { dependencyGraph } from '../../src/swimlane/dependencyLinks';
import { WebGlSwimlaneRenderer } from '../../src/swimlane/WebGlSwimlaneRenderer';
import type { SwimEvent, SwimlaneModel, SwimlaneRenderer } from '../../src/domain/types';

function tinyModel(): SwimlaneModel {
  return {
    minTime: 0,
    maxTime: 1000,
    processes: [
      {
        id: 'p-1',
        name: 'Process 1',
        threads: [
          {
            id: 't-1',
            name: 'AIV0/PIPE_V/status',
            events: [
              { id: 'e-long', name: 'PIPE_V_busy', startTime: 0, duration: 800 },
              { id: 'e-short', name: 'marker_1', startTime: 0, duration: 1 },
            ],
          },
        ],
      },
    ],
  };
}

describe('PR-RENDER: layout + CanvasSwimlaneRenderer', () => {
  it('PR-RENDER-001: hitTest returns event under point', () => {
    const canvas = document.createElement('canvas');
    const renderer = new CanvasSwimlaneRenderer();
    renderer.attach(canvas);
    renderer.resize(400, 120);
    renderer.setModel(tinyModel());
    renderer.setView({ startTime: 0, endTime: 1000, scrollY: 0 });

    const short = renderer.eventScreenRect('e-short');
    expect(short).toBeTruthy();
    const id = renderer.hitTest(short!.x + 1, short!.y + short!.h / 2);
    expect(id).toBe('e-short');
  });

  it('PR-RENDER-002: prefers shorter nested event on overlap', () => {
    const canvas = document.createElement('canvas');
    const renderer = new CanvasSwimlaneRenderer();
    renderer.attach(canvas);
    renderer.resize(400, 120);
    renderer.setModel(tinyModel());
    renderer.setView({ startTime: 0, endTime: 1000, scrollY: 0 });

    const long = renderer.eventScreenRect('e-long')!;
    expect(renderer.hitTest(long.x + 1, long.y + long.h / 2)).toBe('e-short');
  });

  it('PR-RENDER-003: render accepts cursor and rounded event path without throw', () => {
    const canvas = document.createElement('canvas');
    const renderer = new CanvasSwimlaneRenderer();
    renderer.attach(canvas);
    renderer.resize(400, 120);
    renderer.setModel(tinyModel());
    renderer.setView({ startTime: 0, endTime: 1000, scrollY: 0 });
    expect(() => renderer.render()).not.toThrow();
  });

  it('PR-RENDER-004: first lane is offset below group header', () => {
    const canvas = document.createElement('canvas');
    const renderer = new CanvasSwimlaneRenderer();
    renderer.attach(canvas);
    renderer.resize(400, 120);
    renderer.setModel(tinyModel());
    renderer.setView({ startTime: 0, endTime: 1000, scrollY: 0 });

    const rect = renderer.eventScreenRect('e-long');
    expect(rect).toBeTruthy();
    expect(rect!.y).toBeGreaterThanOrEqual(LANE_GROUP_HEADER_HEIGHT);
    expect(rect!.y).toBeLessThan(LANE_GROUP_HEADER_HEIGHT + LANE_HEIGHT);
  });

  it('PR-RENDER-005: shared hitTestLayout matches canvas', () => {
    const layout = rebuildLayout(tinyModel());
    const view = { startTime: 0, endTime: 1000, scrollY: 0 };
    const id = hitTestLayout(layout, view, 400, 1, LANE_GROUP_HEADER_HEIGHT + 11);
    expect(id).toBe('e-short');
  });

  it('PR-RENDER-015: eventRadius narrow vs normal and 1px margin', () => {
    expect(eventRadius(2)).toBe(1);
    expect(eventRadius(3.9)).toBe(1);
    expect(eventRadius(4)).toBe(2);
    expect(eventRadius(40)).toBe(2);
    expect(EVENT_MARGIN).toBe(0.5);
  });

  it('snapEventRect aligns edges to the device-pixel grid at fractional dpr', () => {
    const dpr = 1.25;
    expect(snapCssPx(2.5, dpr)).toBe(2.4);
    const r = snapEventRect(10.4, 2.5, 20.3, 16, dpr);
    expect(r.x * dpr).toBeCloseTo(Math.round(10.4 * dpr));
    expect(r.y * dpr).toBeCloseTo(Math.round(2.5 * dpr));
    expect((r.x + r.w) * dpr).toBeCloseTo(Math.round((10.4 + 20.3) * dpr));
    expect((r.y + r.h) * dpr).toBeCloseTo(Math.round((2.5 + 16) * dpr));
  });

  it('eventPaintRect applies margin then snaps to the device grid', () => {
    const dpr = 1.25;
    const paint = eventPaintRect(10, 2, 20, 16, dpr);
    const expected = snapEventRect(10 + EVENT_MARGIN, 2, 20 - EVENT_MARGIN * 2, 16, dpr);
    expect(paint.x).toBe(expected.x);
    expect(paint.y).toBe(expected.y);
    expect(paint.w).toBe(expected.w);
    expect(paint.h).toBe(expected.h);
    expect(paint.r).toBe(2);
  });

  it('PR-RENDER-007: eventLabelAnchor centers in full and clipped visible rects', () => {
    const full = eventLabelAnchor(100, 200, 400);
    expect(full).toEqual({ cx: 200, maxWidth: 192 });
    const clippedLeft = eventLabelAnchor(-50, 100, 400);
    expect(clippedLeft).toEqual({ cx: 25, maxWidth: 42 });
    const tooNarrow = eventLabelAnchor(-30, 50, 400);
    expect(tooNarrow).toBeNull();
  });
});

const hasWebGl2 = WebGlSwimlaneRenderer.isSupported();

describe('PR-RENDER: WebGlSwimlaneRenderer', () => {
  // jsdom: getContext('webgl2') is null. Chromium coverage is PR-E2E-007.
  it.skipIf(!hasWebGl2)('PR-RENDER-006: attach/render/hitTest when WebGL2 available', () => {
    const canvas = document.createElement('canvas');
    const renderer = new WebGlSwimlaneRenderer();
    expect(renderer.attach(canvas)).toBe(true);
    renderer.resize(400, 120);
    renderer.setModel(tinyModel());
    renderer.setView({ startTime: 0, endTime: 1000, scrollY: 0 });
    expect(() => renderer.render()).not.toThrow();
    const short = renderer.eventScreenRect('e-short');
    expect(short).toBeTruthy();
    expect(renderer.hitTest(short!.x + 1, short!.y + short!.h / 2)).toBe('e-short');
    renderer.dispose();
  });

  it.skipIf(!hasWebGl2)('PR-RENDER-008: WebGL setSearchQuery then render does not throw', () => {
    const canvas = document.createElement('canvas');
    const renderer = new WebGlSwimlaneRenderer();
    expect(renderer.attach(canvas)).toBe(true);
    renderer.resize(400, 120);
    renderer.setModel(tinyModel());
    renderer.setView({ startTime: 0, endTime: 1000, scrollY: 0 });
    renderer.setSearchQuery('PIPE');
    expect(() => renderer.render()).not.toThrow();
    renderer.setSearchQuery('');
    expect(() => renderer.render()).not.toThrow();
    renderer.dispose();
  });

  it('PR-RENDER-010: eventEmphasisDim matches Canvas factors', () => {
    expect(eventEmphasisDim(false, false, true, false)).toBe(0.25);
    expect(eventEmphasisDim(true, false, false, true)).toBe(0.45);
    expect(eventEmphasisDim(false, false, true, true)).toBeCloseTo(0.25 * 0.45);
    expect(eventEmphasisDim(true, true, true, true)).toBe(1);
  });

  it.skipIf(!hasWebGl2)('PR-RENDER-010: WebGL setSelection rebuilds emphasis', () => {
    const canvas = document.createElement('canvas');
    const renderer = new WebGlSwimlaneRenderer();
    expect(renderer.attach(canvas)).toBe(true);
    renderer.resize(400, 120);
    renderer.setModel(tinyModel());
    renderer.setView({ startTime: 0, endTime: 1000, scrollY: 0 });
    renderer.setSelection('e-long', null);
    expect(() => renderer.render()).not.toThrow();
    renderer.setSearchQuery('PIPE');
    expect(() => renderer.render()).not.toThrow();
    renderer.setSelection(null, null);
    expect(() => renderer.render()).not.toThrow();
    renderer.dispose();
  });

  it('PR-RENDER-013: dep neighbors keep full fill and label brightness', () => {
    const parent: SwimEvent = {
      id: 'e-parent',
      name: 'parent',
      startTime: 0,
      duration: 40,
      dependencies: { predecessors: [], successors: [{ tid: 't-b', index: 0 }] },
    };
    const child: SwimEvent = {
      id: 'e-child',
      name: 'child',
      startTime: 50,
      duration: 10,
      dependencies: { predecessors: [{ tid: 't-a', index: 0 }], successors: [] },
    };
    const layout = rebuildLayout({
      minTime: 0,
      maxTime: 100,
      processes: [
        {
          id: 'p-1',
          name: 'P',
          threads: [
            { id: 't-a', name: 'A', events: [parent] },
            { id: 't-b', name: 'B', events: [child] },
            { id: 't-c', name: 'C', events: [{ id: 'e-plain', name: 'plain', startTime: 0, duration: 10 }] },
          ],
        },
      ],
    });
    const ids = dependencyGraph(layout, 'e-parent').ids;
    expect(ids.has('e-parent')).toBe(true);
    expect(ids.has('e-child')).toBe(true);
    expect(ids.has('e-plain')).toBe(false);
    expect(eventEmphasisDim(true, ids.has('e-child'), false, true)).toBe(1);
    expect(eventEmphasisDim(true, ids.has('e-plain'), false, true)).toBe(0.45);
  });

  it('PR-RENDER-009: encodeIntervalPair stays monotonic after float32 round', () => {
    const base = 1_000_000_000;
    const [a, b] = encodeIntervalPair(base + 100, 1, base);
    expect(b).toBeGreaterThan(a);
    // Absolute ns in float32 often collapses nearby timestamps; relative encoding must not.
    const abs = new Float32Array([base + 100, base + 101]);
    expect(abs[0]).toBe(abs[1]);
    expect(b - a).toBeGreaterThanOrEqual(1);
  });
});

describe('PR-RENDER: lane chrome color', () => {
  it('PR-RENDER-011: Canvas + WebGL lane fills use #1f1f1f', async () => {
    const canvasSrc = (await import('../../src/swimlane/CanvasSwimlaneRenderer.ts?raw'))
      .default as string;
    const webglSrc = (await import('../../src/swimlane/WebGlSwimlaneRenderer.ts?raw'))
      .default as string;
    expect(canvasSrc).toMatch(/fillStyle\s*=\s*'#1f1f1f'/);
    expect(canvasSrc.match(/fillStyle\s*=\s*'#1f1f1f'/g)?.length).toBeGreaterThanOrEqual(2);
    expect(webglSrc).toMatch(/laneBg\s*=\s*0x1f\s*\/\s*255/);
  });

  it('PR-RENDER-012: Canvas + WebGL Card header bands use LANE_GROUP_HEADER_FILL', async () => {
    const { LANE_GROUP_HEADER_FILL, LANE_GROUP_HEADER_HOVER } = await import(
      '../../src/swimlane/layout'
    );
    expect(LANE_GROUP_HEADER_FILL).toBe('#2a2a2a');
    expect(LANE_GROUP_HEADER_HOVER).toBe('#323232');
    const canvasSrc = (await import('../../src/swimlane/CanvasSwimlaneRenderer.ts?raw'))
      .default as string;
    const webglSrc = (await import('../../src/swimlane/WebGlSwimlaneRenderer.ts?raw'))
      .default as string;
    expect(canvasSrc).toMatch(/fillStyle\s*=\s*LANE_GROUP_HEADER_FILL/);
    expect(webglSrc).toMatch(/hexToRgb\(LANE_GROUP_HEADER_FILL\)/);
  });
});

describe('PR-RENDER: SwimlaneRenderer surface', () => {
  it('PR-RENDER-014: setDependencyMode and setDependencyDepth are optional', () => {
    const stub: SwimlaneRenderer = {
      attach() {},
      resize() {},
      setModel() {},
      setView() {},
      setSelection() {},
      setSearchQuery() {},
      contentHeight: () => 0,
      eventScreenRect: () => null,
      findEvent: () => null,
      render() {},
      hitTest: () => null,
      dispose() {},
    };
    expect(stub.setDependencyMode).toBeUndefined();
    expect(stub.setDependencyDepth).toBeUndefined();
  });
});
