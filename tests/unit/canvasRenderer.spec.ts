import { describe, expect, it } from 'vitest';
import {
  eventLabelAnchor,
  hitTestLayout,
  rebuildLayout,
  LANE_GROUP_HEADER_HEIGHT,
  LANE_HEIGHT,
} from '../../src/swimlane/layout';
import { CanvasSwimlaneRenderer } from '../../src/swimlane/CanvasSwimlaneRenderer';
import { WebGlSwimlaneRenderer } from '../../src/swimlane/WebGlSwimlaneRenderer';
import type { SwimlaneModel } from '../../src/domain/types';

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
    renderer.setCursorX(40);
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

  it('PR-RENDER-007: eventLabelAnchor centers in full and clipped visible rects', () => {
    const full = eventLabelAnchor(100, 200, 400);
    expect(full).toEqual({ cx: 200, maxWidth: 192 });
    const clippedLeft = eventLabelAnchor(-50, 100, 400);
    expect(clippedLeft).toEqual({ cx: 25, maxWidth: 42 });
    const tooNarrow = eventLabelAnchor(-30, 50, 400);
    expect(tooNarrow).toBeNull();
  });
});

describe('PR-RENDER: WebGlSwimlaneRenderer', () => {
  it('PR-RENDER-006: attach/render/hitTest when WebGL2 available (else skip)', () => {
    const canvas = document.createElement('canvas');
    if (!WebGlSwimlaneRenderer.isSupported(canvas)) {
      expect(WebGlSwimlaneRenderer.isSupported(canvas)).toBe(false);
      return;
    }
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

  it('PR-RENDER-008: WebGL setSearchQuery then render does not throw', () => {
    const canvas = document.createElement('canvas');
    if (!WebGlSwimlaneRenderer.isSupported(canvas)) {
      expect(WebGlSwimlaneRenderer.isSupported(canvas)).toBe(false);
      return;
    }
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
});
