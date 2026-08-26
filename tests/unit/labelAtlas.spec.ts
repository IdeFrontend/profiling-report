import { afterEach, describe, expect, it } from 'vitest';
import {
  CLEARTYPE_TEXT_POW,
  clearEventLabelAtlas,
  eventLabelBlitDest,
  eventLabelDeviceFontPx,
  rasterizeEventLabel,
} from '../../src/swimlane/labelAtlas';

const hasCanvas2d = Boolean(document.createElement('canvas').getContext('2d'));

describe('event label atlas', () => {
  afterEach(() => {
    clearEventLabelAtlas();
  });

  it('eventLabelDeviceFontPx rounds CSS 10px onto the device grid', () => {
    expect(eventLabelDeviceFontPx(1)).toBe(10);
    expect(eventLabelDeviceFontPx(1.25)).toBe(13);
    expect(eventLabelDeviceFontPx(2)).toBe(20);
  });

  it('eventLabelBlitDest snaps dest and clip to integer device pixels', () => {
    const dpr = 1.25;
    const dest = eventLabelBlitDest(100.4, 50.2, 40, 16, 80, dpr);
    expect(Number.isInteger(dest.dx)).toBe(true);
    expect(Number.isInteger(dest.dy)).toBe(true);
    expect(Number.isInteger(dest.clipX)).toBe(true);
    expect(Number.isInteger(dest.clipW)).toBe(true);
  });

  it.skipIf(!hasCanvas2d)('rasterizeEventLabel gray returns a canvas sprite', () => {
    const sprite = rasterizeEventLabel('PIPE_V', 1, 'gray', '#ffffff');
    expect(sprite).toBeTruthy();
    expect(sprite!.mode).toBe('gray');
    expect(sprite!.width).toBeGreaterThan(0);
    expect(sprite!.height).toBeGreaterThan(0);
  });

  it.skipIf(!hasCanvas2d)('rasterizeEventLabel cleartype uses opaque white-on-black coverage', () => {
    const sprite = rasterizeEventLabel('PIPE_V', 1.25, 'cleartype');
    expect(sprite).toBeTruthy();
    expect(sprite!.mode).toBe('cleartype');
    expect(CLEARTYPE_TEXT_POW).toBe(2.25);
    // Cache hit ignores fg color (coverage atlas).
    const again = rasterizeEventLabel('PIPE_V', 1.25, 'cleartype', '#ff0000');
    expect(again).toBe(sprite);
  });
});
