import { describe, expect, it } from 'vitest';
import { measureResizeMinSpan, resizeMeasureEdge, bindWindowPointerDrag } from './measureEdgeResize';

describe('measureEdgeResize', () => {
  it('measureResizeMinSpan is at least 1 and scales with view/px', () => {
    expect(measureResizeMinSpan(0, 1000, 400)).toBe(1000 / 400);
    expect(measureResizeMinSpan(0, 10, 1000)).toBe(1);
  });

  it('left edge moves start and keeps end fixed', () => {
    expect(
      resizeMeasureEdge({
        edge: 'left',
        time: 250,
        fixedOther: 500,
        viewStart: 0,
        viewEnd: 1000,
        minSpan: 1,
      }),
    ).toEqual({ startTime: 250, endTime: 500 });
  });

  it('right edge moves end and keeps start fixed', () => {
    expect(
      resizeMeasureEdge({
        edge: 'right',
        time: 700,
        fixedOther: 200,
        viewStart: 0,
        viewEnd: 1000,
        minSpan: 1,
      }),
    ).toEqual({ startTime: 200, endTime: 700 });
  });

  it('left edge cannot cross right minus minSpan', () => {
    expect(
      resizeMeasureEdge({
        edge: 'left',
        time: 900,
        fixedOther: 500,
        viewStart: 0,
        viewEnd: 1000,
        minSpan: 10,
      }),
    ).toEqual({ startTime: 490, endTime: 500 });
  });

  it('clamps moving edge into the view window', () => {
    expect(
      resizeMeasureEdge({
        edge: 'right',
        time: 2000,
        fixedOther: 200,
        viewStart: 0,
        viewEnd: 1000,
        minSpan: 1,
      }),
    ).toEqual({ startTime: 200, endTime: 1000 });
  });

  it('clamps fixedOther into the view window', () => {
    expect(
      resizeMeasureEdge({
        edge: 'left',
        time: 100,
        fixedOther: 2000,
        viewStart: 0,
        viewEnd: 1000,
        minSpan: 1,
      }),
    ).toEqual({ startTime: 100, endTime: 1000 });
  });

  it('ends drag on window pointerup even if element up is missed', () => {
    const moves: number[] = [];
    const ends: number[] = [];
    const unbind = bindWindowPointerDrag({
      onMove: (x) => moves.push(x),
      onEnd: () => ends.push(1),
    });
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 42, buttons: 1 }));
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 42 }));
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 99, buttons: 0 }));
    expect(moves).toEqual([42]);
    expect(ends).toEqual([1]);
    unbind();
  });

  it('ends drag on move with buttons===0 when pointerup was missed', () => {
    const moves: number[] = [];
    const ends: number[] = [];
    bindWindowPointerDrag({
      onMove: (x) => moves.push(x),
      onEnd: () => ends.push(1),
    });
    const held = new PointerEvent('pointermove', { clientX: 10, buttons: 1 });
    Object.defineProperty(held, 'isTrusted', { value: true });
    window.dispatchEvent(held);
    const released = new PointerEvent('pointermove', { clientX: 20, buttons: 0 });
    Object.defineProperty(released, 'isTrusted', { value: true });
    window.dispatchEvent(released);
    const after = new PointerEvent('pointermove', { clientX: 30, buttons: 0 });
    Object.defineProperty(after, 'isTrusted', { value: true });
    window.dispatchEvent(after);
    expect(moves).toEqual([10]);
    expect(ends).toEqual([1]);
  });
});
