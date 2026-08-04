import { describe, expect, it, vi } from 'vitest';
import { CanvasSwimlaneRenderer } from '../../src/swimlane/CanvasSwimlaneRenderer';
import type { SwimlaneModel } from '../../src/domain/types';

function tinyModel(): SwimlaneModel {
  return {
    minTime: 0,
    maxTime: 1000,
    processes: [
      {
        id: 'p-1',
        name: 'Kernel',
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

function multiProcessModel(): SwimlaneModel {
  return {
    minTime: 0,
    maxTime: 100,
    processes: [
      {
        id: 'p-a',
        name: 'AIC0',
        threads: [
          { id: 't-a', name: 'PIPE_V', events: [{ id: 'e-a', name: 'a', startTime: 0, duration: 10 }] },
        ],
      },
      {
        id: 'p-b',
        name: 'AIV1',
        threads: [
          { id: 't-b', name: 'PIPE_V', events: [{ id: 'e-b', name: 'b', startTime: 0, duration: 10 }] },
        ],
      },
    ],
  };
}

function mockCtx() {
  return {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    roundRect: vi.fn(),
    arcTo: vi.fn(),
    closePath: vi.fn(),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
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

  it('PR-RENDER-003: render paints lanes/events/cursor via 2d context', () => {
    const canvas = document.createElement('canvas');
    const ctx = mockCtx();
    vi.spyOn(canvas, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);

    const renderer = new CanvasSwimlaneRenderer();
    renderer.attach(canvas);
    renderer.resize(400, 80);
    renderer.setModel(tinyModel());
    renderer.setView({ startTime: 0, endTime: 1000, scrollY: 0 });
    renderer.setCursorX(40);
    renderer.render();

    expect(ctx.clearRect).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
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
    expect(rect!.y).toBeGreaterThanOrEqual(28);
    expect(rect!.y).toBeLessThan(28 + 22);
  });

  it('PR-RENDER-005: multi-process headers offset second group lanes', () => {
    const canvas = document.createElement('canvas');
    const renderer = new CanvasSwimlaneRenderer();
    renderer.attach(canvas);
    renderer.resize(400, 200);
    renderer.setModel(multiProcessModel());
    renderer.setView({ startTime: 0, endTime: 100, scrollY: 0 });

    const a = renderer.eventScreenRect('e-a')!;
    const b = renderer.eventScreenRect('e-b')!;
    // second process: header(28) + lane(22) + header(28) → lane starts at 78
    expect(a.y).toBeGreaterThanOrEqual(28);
    expect(b.y).toBeGreaterThanOrEqual(28 + 22 + 28);
    expect(renderer.contentHeight()).toBe(28 + 22 + 28 + 22);
  });
});
