import { describe, expect, it, vi } from 'vitest';
import {
  encodeIntervalPair,
  EVENT_MARGIN,
  eventEmphasisDim,
  eventLabelAnchor,
  eventPaintRect,
  eventRadius,
  hitTestLayout,
  rebuildLayout,
  
  snapEventRect,
  LANE_GROUP_HEADER_HEIGHT,
  LANE_HEIGHT,
} from '../../src/swimlane/layout';
import { CanvasSwimlaneRenderer } from '../../src/swimlane/CanvasSwimlaneRenderer';
import { dependencyGraph, dependencyStrokeWidth } from '../../src/swimlane/dependencyLinks';
import { WebGlSwimlaneRenderer } from '../../src/swimlane/WebGlSwimlaneRenderer';
import { maxRR, minRR, rrSwitchThreshold, rrToDevicePx } from '../../src/swimlane/shaders';
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

function depModel(): SwimlaneModel {
  return {
    minTime: 0,
    maxTime: 100,
    processes: [
      {
        id: 'p-1',
        name: 'P',
        threads: [
          {
            id: 't-a',
            name: 'A',
            events: [
              {
                id: 'e-parent',
                name: 'parent',
                startTime: 0,
                duration: 40,
                dependencies: { predecessors: [], successors: [{ tid: 't-b', index: 0 }] },
              },
            ],
          },
          {
            id: 't-b',
            name: 'B',
            events: [
              {
                id: 'e-child',
                name: 'child',
                startTime: 50,
                duration: 10,
                dependencies: { predecessors: [{ tid: 't-a', index: 0 }], successors: [] },
              },
            ],
          },
        ],
      },
    ],
  };
}

function mock2dContext(): CanvasRenderingContext2D {
  const ctx: Record<string, unknown> = {
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
  };
  for (const m of [
    'clearRect', 'fillRect', 'beginPath', 'moveTo', 'lineTo', 'stroke', 'fill', 'save',
    'restore', 'arcTo', 'closePath', 'setTransform', 'bezierCurveTo', 'fillText',
  ]) {
    ctx[m] = () => {};
  }
  ctx.measureText = () => ({ width: 0 });
  ctx.createLinearGradient = () => ({ addColorStop: () => {} });
  return ctx as unknown as CanvasRenderingContext2D;
}

/**
 * jsdom has no 2D context, so stand one in that records the colour of every fill and of
 * every string drawn, and shrugs off the rest. Enough to prove which rows and blocks got
 * which colour, which is the whole question for lane hover and the event states.
 */
function recordingCanvas(): {
  canvas: HTMLCanvasElement;
  fills: string[];
  texts: Map<string, string>;
} {
  const fills: string[] = [];
  const texts = new Map<string, string>();
  let style = '';
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get(_t, p) {
      if (p === 'fillStyle') return style;
      // Rows and headers go through fillRect, event bodies through roundRect + fill.
      if (p === 'fillRect' || p === 'fill') return () => void fills.push(style);
      if (p === 'fillText') return (s: string) => void texts.set(s, style);
      if (p === 'measureText') return () => ({ width: 8 });
      return () => undefined;
    },
    set(_t, p, v) {
      if (p === 'fillStyle') style = String(v);
      return true;
    },
  });
  const canvas = document.createElement('canvas');
  canvas.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext'];
  return { canvas, fills, texts };
}

describe('PR-RENDER: layout + CanvasSwimlaneRenderer', () => {
  it('PR-RENDER-001: hitTest returns event under point', () => {
    const canvas = document.createElement('canvas');
    const renderer = new CanvasSwimlaneRenderer();
    renderer.attach(canvas);
    renderer.resize(400, 120, 1);
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
    renderer.resize(400, 120, 1);
    renderer.setModel(tinyModel());
    renderer.setView({ startTime: 0, endTime: 1000, scrollY: 0 });

    const long = renderer.eventScreenRect('e-long')!;
    expect(renderer.hitTest(long.x + 1, long.y + long.h / 2)).toBe('e-short');
  });

  it('PR-RENDER-003: render accepts cursor and rounded event path without throw', () => {
    const canvas = document.createElement('canvas');
    const renderer = new CanvasSwimlaneRenderer();
    renderer.attach(canvas);
    renderer.resize(400, 120, 1);
    renderer.setModel(tinyModel());
    renderer.setView({ startTime: 0, endTime: 1000, scrollY: 0 });
    expect(() => renderer.render()).not.toThrow();
  });

  it('PR-RENDER-004: first lane is offset below group header', () => {
    const canvas = document.createElement('canvas');
    const renderer = new CanvasSwimlaneRenderer();
    renderer.attach(canvas);
    renderer.resize(400, 120, 1);
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

  it('PR-RENDER-017: eventRadius is CSS-px policy × dpr (device-px radius)', () => {
    // CSS-px raw width decides the corner radius, then it scales by dpr (rounded).
    expect(eventRadius(2, 1)).toBe(1); // narrow
    expect(eventRadius(3.9, 1)).toBe(1);
    expect(eventRadius(4, 1)).toBe(2); // wide
    expect(eventRadius(40, 1)).toBe(2);
    expect(eventRadius(2, 2)).toBe(2); // 1 CSS px × 2 dpr
    expect(eventRadius(40, 2)).toBe(4); // 2 CSS px × 2 dpr
    expect(EVENT_MARGIN).toBe(0.5);
  });

  it('PR-RENDER-017b: uRR threshold is exact × dpr; only radii round (fractional dpr)', () => {
    // Mirrors the WebGL render() upload: uRR = (rrToDevicePx(minRR,dpr), rrToDevicePx(maxRR,dpr),
    // rrSwitchThreshold * dpr). Painted radii round to integer device px; the `rawW < uRR.z`
    // threshold stays exact so the < 4 CSS px cutoff tracks the true CSS boundary at any dpr.
    // At dpr 1.6 the rounded threshold (6) would drift off the exact 6.4, so `z` must be exact.
    expect(rrSwitchThreshold * 1.6).toBeCloseTo(6.4, 10);
    expect(rrToDevicePx(rrSwitchThreshold, 1.6)).toBe(6); // demonstrates rounding would differ
    for (const dpr of [1.25, 1.5, 1.6]) {
      expect(rrToDevicePx(minRR, dpr)).toBe((minRR * dpr + 0.5) | 0);
      expect(rrToDevicePx(maxRR, dpr)).toBe((maxRR * dpr + 0.5) | 0);
    }
    // Concrete values document the parity at 1.25: radii 1/3 device px, exact threshold 5.
    expect(rrToDevicePx(minRR, 1.25)).toBe(1);
    expect(rrToDevicePx(maxRR, 1.25)).toBe(3);
    expect(rrSwitchThreshold * 1.25).toBe(5);
    expect(rrSwitchThreshold * 1.5).toBe(6);
  });

  it('PR-RENDER-018: snapEventRect aligns edges to integer device pixels', () => {
    const r = snapEventRect(10.4, 2.5, 20.3, 16);
    expect(r.x).toBe(10);
    expect(r.y).toBe(3);
    expect(r.x + r.w).toBe(Math.round(10.4 + 20.3));
    expect(r.y + r.h).toBe(Math.round(2.5 + 16));
    expect(r.w).toBeGreaterThanOrEqual(1);
    expect(r.h).toBeGreaterThanOrEqual(1);
  });

  it('eventPaintRect applies 1 device-px gap then snaps', () => {
    const paint = eventPaintRect(10, 2, 20, 16);
    const expected = snapEventRect(10 + EVENT_MARGIN, 2, 20 - EVENT_MARGIN * 2, 16);
    expect(paint.x).toBe(expected.x);
    expect(paint.y).toBe(expected.y);
    expect(paint.w).toBe(expected.w);
    expect(paint.h).toBe(expected.h);
    expect(paint.r).toBe(2);
  });

  it('PR-RENDER-019: resize sets buffer without style sizing', () => {
    const canvas = document.createElement('canvas');
    const renderer = new CanvasSwimlaneRenderer();
    renderer.attach(canvas);
    renderer.resize(800, 240, 2);
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(240);
    expect(canvas.style.width).toBe('');
    expect(canvas.style.height).toBe('');
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
    renderer.resize(400, 120, 1);
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
    renderer.resize(400, 120, 1);
    renderer.setModel(tinyModel());
    renderer.setView({ startTime: 0, endTime: 1000, scrollY: 0 });
    renderer.setSearchQuery('PIPE');
    expect(() => renderer.render()).not.toThrow();
    renderer.setSearchQuery('');
    expect(() => renderer.render()).not.toThrow();
    renderer.dispose();
  });

  it('PR-RENDER-010: eventEmphasisDim matches Canvas factors', async () => {
    expect(eventEmphasisDim(false, false, true, false)).toBe(0.25);
    expect(eventEmphasisDim(true, false, false, true)).toBe(0.45);
    expect(eventEmphasisDim(false, false, true, true)).toBeCloseTo(0.25 * 0.45);
    expect(eventEmphasisDim(true, true, true, true)).toBe(1);
    // Hovered (keepBright) under a selection: full strength, same as the selection itself.
    expect(eventEmphasisDim(true, true, false, true)).toBe(1);

    // Both Canvas paths (main + overlay) wire hover into keepBright — otherwise a light
    // hover fill under the selection dim is what made dark labels unreadable.
    const canvasSrc = (await import('../../src/swimlane/CanvasSwimlaneRenderer.ts?raw'))
      .default as string;
    expect(canvasSrc.match(/bright\.has\(item\.id\)\s*\|\|\s*item\.id\s*===\s*this\.hoveredId/g))
      .toHaveLength(2);
  });

  it.skipIf(!hasWebGl2)('PR-RENDER-010: WebGL setSelection rebuilds emphasis', () => {
    const canvas = document.createElement('canvas');
    const renderer = new WebGlSwimlaneRenderer();
    expect(renderer.attach(canvas)).toBe(true);
    renderer.resize(400, 120, 1);
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

  it('PR-RENDER-022: dependency stroke width is 2 CSS px rounded to device px', () => {
    expect(dependencyStrokeWidth(1)).toBe(2);
    expect(dependencyStrokeWidth(2)).toBe(4);
    expect(dependencyStrokeWidth(1.25)).toBe(3); // round(2.5)
    expect(dependencyStrokeWidth(2.5)).toBe(5);
    expect(dependencyStrokeWidth(0.4)).toBe(1); // min 1
  });

  it('Canvas applies dpr-scaled dependency stroke width when drawing curves', () => {
    const canvas = document.createElement('canvas');
    const ctx = mock2dContext();
    let curveLineWidth = 0;
    ctx.bezierCurveTo = () => {
      curveLineWidth = ctx.lineWidth;
    };
    vi.spyOn(canvas, 'getContext').mockReturnValue(ctx);

    const renderer = new CanvasSwimlaneRenderer();
    renderer.attach(canvas);
    renderer.resize(400, 120, 2);
    renderer.setModel(depModel());
    renderer.setSelection('e-parent', null);
    renderer.setView({ startTime: 0, endTime: 100, scrollY: 0 });
    renderer.render();

    expect(curveLineWidth).toBe(dependencyStrokeWidth(2));
  });
});

describe('PR-RENDER: lane chrome color', () => {
  it('PR-RENDER-011: Canvas + WebGL lane fills use #1f1f1f', async () => {
    const { LANE_FILL } = await import('../../src/swimlane/layout');
    expect(LANE_FILL).toBe('#1f1f1f');
    const canvasSrc = (await import('../../src/swimlane/CanvasSwimlaneRenderer.ts?raw'))
      .default as string;
    const webglSrc = (await import('../../src/swimlane/WebGlSwimlaneRenderer.ts?raw'))
      .default as string;
    expect(canvasSrc).toMatch(/fillStyle\s*=\s*LANE_FILL/);
    expect(webglSrc).toMatch(/laneBg\s*=\s*hexToRgb\(LANE_FILL\)/);
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

  it('PR-RENDER-020b: overlay underpaint uses LANE_HOVER_FILL when the row is hovered', async () => {
    const { LANE_HOVER_FILL, LANE_FILL } = await import('../../src/swimlane/layout');
    const { SwimlaneOverlayPainter } = await import('../../src/swimlane/CanvasSwimlaneRenderer');
    const { rebuildLayout } = await import('../../src/swimlane/layout');

    const paint = (hoveredLane: string | null, search: string) => {
      const { canvas, fills } = recordingCanvas();
      const overlay = new SwimlaneOverlayPainter();
      overlay.attach(canvas);
      overlay.resize(400, 120, 1);
      overlay.setLayout(rebuildLayout(tinyModel()));
      overlay.setView({ startTime: 0, endTime: 1000, scrollY: 0 });
      // Hovered event that misses the search → dim < 1, so the erase pass is not a no-op.
      overlay.setSelection(null, 'e-long');
      overlay.setSearchQuery(search);
      overlay.setHoveredLane(hoveredLane);
      overlay.render();
      return fills;
    };

    const resting = paint(null, 'nope');
    expect(resting).toContain(LANE_FILL);
    expect(resting).not.toContain(LANE_HOVER_FILL);

    const hovered = paint('t-1', 'nope');
    expect(hovered).toContain(LANE_HOVER_FILL);
  });

  it('PR-RENDER-020: setHoveredLane tints only that row, and no event fill', async () => {
    const { LANE_HOVER_FILL, LANE_FILL } = await import('../../src/swimlane/layout');
    expect(LANE_HOVER_FILL).toBe('#363636');

    const paint = (hoveredLane: string | null): string[] => {
      const { canvas, fills } = recordingCanvas();
      const renderer = new CanvasSwimlaneRenderer();
      renderer.attach(canvas);
      renderer.resize(400, 120, 1);
      renderer.setModel(tinyModel());
      renderer.setView({ startTime: 0, endTime: 1000, scrollY: 0 });
      renderer.setHoveredLane(hoveredLane);
      renderer.render();
      return fills;
    };

    const resting = paint(null);
    const hovered = paint('t-1');
    expect(resting).toContain(LANE_FILL);
    expect(resting).not.toContain(LANE_HOVER_FILL);

    // Exactly one filled rect changes colour, and it is a lane background going to the
    // hover fill. Event bodies are in these lists too, so this is also the assertion
    // that hovering a lane leaves every event's colour alone.
    expect(hovered).toHaveLength(resting.length);
    const changed = resting
      .map((fill, i) => ({ i, from: fill, to: hovered[i]! }))
      .filter((c) => c.from !== c.to);
    expect(changed).toEqual([{ i: changed[0]?.i ?? -1, from: LANE_FILL, to: LANE_HOVER_FILL }]);

    // A folder id never matches a leaf row, so hovering one tints nothing.
    expect(paint('p-1')).not.toContain(LANE_HOVER_FILL);
  });

  it('PR-RENDER-021: each block paints its state fill, each label the matching contrast', async () => {
    const { eventFill, labelColorOn, colorForThread } = await import('../../src/domain/laneColors');
    const base = colorForThread('AIV0/PIPE_V/status');

    const paint = (selected: string | null, hovered: string | null) => {
      const { canvas, fills, texts } = recordingCanvas();
      const renderer = new CanvasSwimlaneRenderer();
      renderer.attach(canvas);
      renderer.resize(400, 120, 1);
      renderer.setModel(tinyModel());
      renderer.setView({ startTime: 0, endTime: 1000, scrollY: 0 });
      renderer.setSelection(selected, hovered);
      renderer.render();
      return { fills, texts };
    };

    for (const [state, sel, hov] of [
      ['normal', null, null],
      ['hover', null, 'e-long'],
      ['selected', 'e-long', null],
      // Hovering your own selection keeps the selected fill.
      ['selected', 'e-long', 'e-long'],
    ] as const) {
      const want = eventFill(base, state);
      const { fills, texts } = paint(sel, hov);
      expect(fills, `${state} fill`).toContain(want);
      expect(texts.get('PIPE_V_busy'), `${state} label`).toBe(labelColorOn(want));
    }
  });

  it('PR-RENDER-024: ClearType mode still labels hovered/selected blocks via the overlay', async () => {
    const { eventFill, labelColorOn, colorForThread } = await import('../../src/domain/laneColors');
    const { SwimlaneOverlayPainter } = await import('../../src/swimlane/CanvasSwimlaneRenderer');
    const { rebuildLayout } = await import('../../src/swimlane/layout');
    const base = colorForThread('AIV0/PIPE_V/status');

    const paint = (hovered: string | null) => {
      const { canvas, texts } = recordingCanvas();
      const overlay = new SwimlaneOverlayPainter();
      overlay.attach(canvas);
      overlay.resize(400, 120, 1);
      overlay.setLayout(rebuildLayout(tinyModel()));
      overlay.setView({ startTime: 0, endTime: 1000, scrollY: 0 });
      overlay.setDrawEventLabels(false); // WebGL ClearType owns the resting labels
      overlay.setSelection(null, hovered);
      overlay.render();
      return texts;
    };

    // Resting: the overlay draws no labels (the WebGL ClearType pass owns them).
    expect(paint(null).get('PIPE_V_busy')).toBeUndefined();

    // Hovered: the overlay still draws the label over the lifted state fill, in that fill's contrast.
    expect(paint('e-long').get('PIPE_V_busy')).toBe(labelColorOn(eventFill(base, 'hover')));
  });
});

describe('PR-RENDER: SwimlaneRenderer surface', () => {
  it('PR-RENDER-014: setDependencyMode, setDependencyDepth and setHoveredLane are optional', () => {
    const stub: SwimlaneRenderer = {
      attach() {},
      resize(_w: number, _h: number, _dpr: number) {},
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
    // Compiles without the three optionals; calling through ?. is the host contract.
    expect(stub.setDependencyMode).toBeUndefined();
    expect(stub.setDependencyDepth).toBeUndefined();
    expect(stub.setHoveredLane).toBeUndefined();
  });
});
