import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLEARTYPE_TEXT_POW, TEXT_CLEARTYPE_FS } from '../../src/swimlane/shaders';
import { centeredTextBaseline, clearTypeRasterSupported, eventLabelFont, fitEventLabel, fitTextWidth, TextAtlas } from '../../src/swimlane/textAtlas';

describe('PR-RENDER: ClearType text atlas', () => {
  it('PR-RENDER-037: text shaders export sudu gamma constants', () => {
    expect(CLEARTYPE_TEXT_POW).toBe(2.25);
    expect(TEXT_CLEARTYPE_FS).toContain('mix(uBgColor.rgb, uColor.rgb');
  });

  it('PR-RENDER-037: eventLabelFont uses shared CSS px size', () => {
    expect(eventLabelFont(12)).toMatch(/^400 12px /);
  });

  it('PR-RENDER-037: clearTypeRasterSupported is false in jsdom', () => {
    expect(clearTypeRasterSupported()).toBe(false);
  });

  it('PR-RENDER-037: fitTextWidth truncates over-wide labels with ellipsis', () => {
    // Monospace measurer: width == char count.
    const mono = { measureText: (s: string) => ({ width: s.length }) };
    expect(fitTextWidth(mono, 'short', 10)).toBe('short');
    const cut = fitTextWidth(mono, 'abcdefghijklmnop', 8);
    expect(cut).toBe('abcde...');
    expect(cut.length).toBeLessThanOrEqual(8);
  });

  it('PR-RENDER-037: fitTextWidth strips a trailing space/underscore before the ellipsis', () => {
    const mono = { measureText: (s: string) => ({ width: s.length }) };
    // Cut lands on a trailing '_' → dropped, ellipsis follows the word.
    expect(fitTextWidth(mono, 'a_bcdef', 5)).toBe('a...');
    // Cut lands on a trailing space → dropped.
    expect(fitTextWidth(mono, 'a bcdef', 5)).toBe('a...');
  });

  it('PR-RENDER-037: fitEventLabel picks draw/shrink/truncate/skip by width ratio', () => {
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

  it('PR-RENDER-037: centeredTextBaseline centers ink and falls back to middle', () => {
    // Ink metrics present → alphabetic baseline shifted by ascent/2 (descent ignored).
    expect(centeredTextBaseline({ width: 10, actualBoundingBoxAscent: 9, actualBoundingBoxDescent: 3 }, 20)).toEqual({
      baselineY: 24.5,
      baseline: 'alphabetic',
    });
    // Below-baseline ink (an underscore / descender) must not shift the body: same ascent,
    // different descent → identical baseline.
    expect(centeredTextBaseline({ width: 10, actualBoundingBoxAscent: 9, actualBoundingBoxDescent: 0 }, 20)).toEqual({
      baselineY: 24.5,
      baseline: 'alphabetic',
    });
    // No ink metrics (jsdom stub) → middle baseline, unshifted.
    expect(centeredTextBaseline({ width: 10 }, 20)).toEqual({ baselineY: 20, baseline: 'middle' });
    expect(centeredTextBaseline({ width: 10, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 3 }, 20)).toEqual({
      baselineY: 20,
      baseline: 'middle',
    });
  });
});

describe('PR-RENDER: TextAtlas cache bounds', () => {
  /** Stretch FakeCtx `measureText` (1 = width==char count). Truncate-reuse needs wider glyphs. */
  let measureMul = 1;

  /** Minimal OffscreenCanvas stub so TextAtlas can rasterize in jsdom. */
  class FakeCtx {
    font = '';
    textAlign = 'center';
    textBaseline = 'alphabetic';
    fillStyle = '#000000';
    measureText(text: string): { width: number; actualBoundingBoxAscent: number; actualBoundingBoxDescent: number } {
      // Monospace: width == char count × measureMul; ink metrics so centeredTextBaseline is alphabetic.
      return { width: text.length * measureMul, actualBoundingBoxAscent: 9, actualBoundingBoxDescent: 3 };
    }
    fillRect(): void {}
    fillText(): void {}
  }
  class FakeCanvas {
    constructor(public width: number, public height: number) {}
    getContext(): FakeCtx {
      return new FakeCtx();
    }
  }

  const deleted: unknown[] = [];
  let nextId = 0;
  const gl = {
    createTexture: () => ({ id: ++nextId }),
    bindTexture: () => {},
    pixelStorei: () => {},
    texImage2D: () => {},
    texParameteri: () => {},
    deleteTexture: (t: unknown) => {
      deleted.push(t);
    },
  } as unknown as WebGL2RenderingContext;

  afterEach(() => {
    vi.unstubAllGlobals();
    deleted.length = 0;
    nextId = 0;
    measureMul = 1;
  });

  it('PR-RENDER-038: evicts least-recently-used glyphs beyond the byte budget', () => {
    vi.stubGlobal('OffscreenCanvas', FakeCanvas);
    // 3-char label at 12px: w = (3 + 2*2) = 7, h = ceil(12*1.5) = 18 → 7*18*4 = 504 bytes each.
    const atlas = new TextAtlas(1000); // holds one glyph (504); the second evicts the first
    const a = atlas.get(gl, 'aaa', 12, 100)!;
    const b = atlas.get(gl, 'bbb', 12, 100)!;
    expect(deleted).toContain(a.texture); // 'aaa' evicted once 'bbb' pushed bytes to 1008 > 1000
    const c = atlas.get(gl, 'ccc', 12, 100)!;
    expect(deleted).toContain(b.texture); // 'bbb' evicted on the third insert
    expect(deleted).not.toContain(c.texture);
    expect(c.width).toBeGreaterThan(0);
  });

  it('PR-RENDER-038: cache hit refreshes recency and clear() deletes all', () => {
    vi.stubGlobal('OffscreenCanvas', FakeCanvas);
    const atlas = new TextAtlas(1600); // holds three glyphs (1512); the fourth evicts the oldest
    const a = atlas.get(gl, 'aaa', 12, 100)!;
    const b = atlas.get(gl, 'bbb', 12, 100)!;
    atlas.get(gl, 'aaa', 12, 100); // hit → 'aaa' becomes most-recent, 'bbb' is now LRU
    atlas.get(gl, 'ccc', 12, 100); // 1512 ≤ 1600, no eviction
    atlas.get(gl, 'ddd', 12, 100); // 2016 > 1600 → evict LRU ('bbb'), not 'aaa'
    expect(deleted).toContain(b.texture);
    expect(deleted).not.toContain(a.texture);

    atlas.clear(gl);
    expect(deleted).toContain(a.texture); // remaining glyphs deleted on clear
  });

  it('PR-RENDER-038: skip reuses the probe canvas and cached measure (no realloc each frame)', () => {
    let allocs = 0;
    class CountingCanvas {
      width: number;
      height: number;
      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        allocs += 1;
      }
      getContext(): FakeCtx {
        return new FakeCtx();
      }
    }
    vi.stubGlobal('OffscreenCanvas', CountingCanvas);

    const atlas = new TextAtlas(1000);
    const long = 'x'.repeat(100); // measured width 100; maxWidth 10 → ratio 0.1 → skip
    expect(atlas.get(gl, long, 12, 10)).toBeNull();
    const allocsAfterFirst = allocs; // one probe canvas; skip never opens the raster canvas
    expect(allocsAfterFirst).toBe(1);

    expect(atlas.get(gl, long, 12, 10)).toBeNull();
    expect(allocs).toBe(allocsAfterFirst);
  });

  it('PR-RENDER-038: glyphs key by drawn text so clip-width pan reuses the texture', () => {
    vi.stubGlobal('OffscreenCanvas', FakeCanvas);
    const atlas = new TextAtlas(1600);
    const a = atlas.get(gl, 'aaa', 12, 100.2)!;
    // Sub-pixel clip-width delta: same integer fit bucket, same glyph object.
    expect(atlas.get(gl, 'aaa', 12, 100.4)).toBe(a);
    // Wider clip that still draws as-is: same drawn text → same texture (not a new key).
    const wide = atlas.get(gl, 'aaa', 12, 200)!;
    expect(wide.texture).toBe(a.texture);
    expect(wide.scaleX).toBe(1);
  });

  it('PR-RENDER-038: shrink reuses the full-text glyph and returns scaleX', () => {
    vi.stubGlobal('OffscreenCanvas', FakeCanvas);
    const atlas = new TextAtlas(1600);
    const ten = 'abcdefghij'; // measured 10; 8–9 → shrink; 10 → draw
    const shrunk = atlas.get(gl, ten, 12, 9)!;
    expect(shrunk.scaleX).toBe(0.9);
    const tighter = atlas.get(gl, ten, 12, 8)!;
    expect(tighter.texture).toBe(shrunk.texture);
    expect(tighter.scaleX).toBe(0.8);
    const full = atlas.get(gl, ten, 12, 10)!;
    expect(full.texture).toBe(shrunk.texture);
    expect(full.scaleX).toBe(1);
  });

  it('PR-RENDER-038: truncate keys by drawn text so shared prefixes reuse the glyph', () => {
    vi.stubGlobal('OffscreenCanvas', FakeCanvas);
    measureMul = 10; // char width 10 so several integer maxWidths share one prefix
    const atlas = new TextAtlas(50_000);
    const ten = 'abcdefghij'; // measured 100; 55 and 58 both truncate to 'ab...'
    const a = atlas.get(gl, ten, 12, 55)!;
    const b = atlas.get(gl, ten, 12, 58)!;
    expect(a.scaleX).toBe(1);
    expect(b.texture).toBe(a.texture);
  });
});
