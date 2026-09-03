import { describe, expect, it } from 'vitest';
import { CLEARTYPE_TEXT_POW, GRAYSCALE_TEXT_POW, TEXT_CLEARTYPE_FS, TEXT_GRAY_FS } from '../../src/swimlane/shaders';
import { centeredTextBaseline, clearTypeRasterSupported, eventLabelFont, fitTextWidth } from '../../src/swimlane/textAtlas';

describe('PR-RENDER: ClearType text atlas', () => {
  it('PR-RENDER-023: text shaders export sudu gamma constants', () => {
    expect(CLEARTYPE_TEXT_POW).toBe(2.25);
    expect(GRAYSCALE_TEXT_POW).toBe(0.625);
    expect(TEXT_CLEARTYPE_FS).toContain('mix(uBgColor.rgb, uColor.rgb');
    expect(TEXT_GRAY_FS).toContain('texture(sDiffuse, textureUV).a');
  });

  it('PR-RENDER-023: eventLabelFont uses shared CSS px size', () => {
    expect(eventLabelFont(12)).toMatch(/^400 12px /);
  });

  it('PR-RENDER-023: clearTypeRasterSupported is false in jsdom', () => {
    expect(clearTypeRasterSupported()).toBe(false);
  });

  it('PR-RENDER-023: fitTextWidth truncates over-wide labels with ellipsis', () => {
    // Monospace measurer: width == char count.
    const mono = { measureText: (s: string) => ({ width: s.length }) };
    expect(fitTextWidth(mono, 'short', 10)).toBe('short');
    const cut = fitTextWidth(mono, 'abcdefghijklmnop', 8);
    expect(cut).toBe('abcde...');
    expect(cut.length).toBeLessThanOrEqual(8);
  });

  it('PR-RENDER-023: centeredTextBaseline centers ink and falls back to middle', () => {
    // Ink metrics present → alphabetic baseline shifted so ink midpoint lands on centerY.
    expect(centeredTextBaseline({ width: 10, actualBoundingBoxAscent: 9, actualBoundingBoxDescent: 3 }, 20)).toEqual({
      baselineY: 23,
      baseline: 'alphabetic',
    });
    // No ink metrics (jsdom stub) → middle baseline, unshifted.
    expect(centeredTextBaseline({ width: 10 }, 20)).toEqual({ baselineY: 20, baseline: 'middle' });
    expect(centeredTextBaseline({ width: 10, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 }, 20)).toEqual({
      baselineY: 20,
      baseline: 'middle',
    });
  });
});
