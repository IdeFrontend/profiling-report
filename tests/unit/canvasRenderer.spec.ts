import { describe, expect, it } from 'vitest';
import { CanvasSwimlaneRenderer } from '../../src/swimlane/CanvasSwimlaneRenderer';
import type { SwimlaneModel } from '../../src/core/types';

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

describe('PR-RENDER: CanvasSwimlaneRenderer', () => {
  it('PR-RENDER-001: hitTest returns event under point', () => {
    const canvas = document.createElement('canvas');
    const renderer = new CanvasSwimlaneRenderer();
    renderer.attach(canvas);
    renderer.resize(400, 80);
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
    renderer.resize(400, 80);
    renderer.setModel(tinyModel());
    renderer.setView({ startTime: 0, endTime: 1000, scrollY: 0 });

    const long = renderer.eventScreenRect('e-long')!;
    expect(renderer.hitTest(long.x + 1, long.y + long.h / 2)).toBe('e-short');
  });

  it('PR-RENDER-003: render accepts cursor and rounded event path without throw', () => {
    const canvas = document.createElement('canvas');
    const renderer = new CanvasSwimlaneRenderer();
    renderer.attach(canvas);
    renderer.resize(400, 80);
    renderer.setModel(tinyModel());
    renderer.setView({ startTime: 0, endTime: 1000, scrollY: 0 });
    renderer.setCursorX(40);
    expect(() => renderer.render()).not.toThrow();
  });
});
