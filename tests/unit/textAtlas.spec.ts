import { describe, expect, it } from 'vitest';
import { CLEARTYPE_TEXT_POW, GRAYSCALE_TEXT_POW, TEXT_CLEARTYPE_FS, TEXT_GRAY_FS } from '../../src/swimlane/shaders';
import { centeredTextBaseline, clearTypeRasterSupported, eventLabelFont, fitEventLabel, fitTextWidth } from '../../src/swimlane/textAtlas';

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

  it('PR-RENDER-023: fitTextWidth strips a trailing space/underscore before the ellipsis', () => {
    const mono = { measureText: (s: string) => ({ width: s.length }) };
    // Cut lands on a trailing '_' → dropped, ellipsis follows the word.
    expect(fitTextWidth(mono, 'a_bcdef', 5)).toBe('a...');
    // Cut lands on a trailing space → dropped.
    expect(fitTextWidth(mono, 'a bcdef', 5)).toBe('a...');
  });

  it('PR-RENDER-023: fitEventLabel picks draw/shrink/truncate/skip by width ratio', () => {
    const mono = { measureText: (s: string) => ({ width: s.length }) };
    const ten = 'abcdefghij'; // measured width 10
    // Fits the rect → draw as-is.
    expect(fitEventLabel(mono, ten, 10)).toEqual({ kind: 'draw', text: ten });
    // Rect ≥ 80% of measured → horizontal shrink (scaleX = rect / measured).
    expect(fitEventLabel(mono, ten, 9)).toEqual({ kind: 'shrink', text: ten, scaleX: 0.9 });
    expect(fitEventLabel(mono, ten, 8)).toEqual({ kind: 'shrink', text: ten, scaleX: 0.8 });
    // 30–80% of measured → truncate with trailing ellipsis.
    expect(fitEventLabel(mono, ten, 5)).toEqual({ kind: 'truncate', text: 'ab...' });
    // Below 30% → skip.
    expect(fitEventLabel(mono, ten, 2)).toEqual({ kind: 'skip' });
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
