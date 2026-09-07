import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLEARTYPE_TEXT_POW, GRAYSCALE_TEXT_POW, TEXT_CLEARTYPE_FS, TEXT_GRAY_FS } from '../../src/swimlane/shaders';
import { centeredTextBaseline, clearTypeRasterSupported, eventLabelFont, fitEventLabel, fitTextWidth, TextAtlas } from '../../src/swimlane/textAtlas';

describe('PR-RENDER: ClearType text atlas', () => {
  it('PR-RENDER-026: text shaders export sudu gamma constants', () => {
    expect(CLEARTYPE_TEXT_POW).toBe(2.25);
    expect(GRAYSCALE_TEXT_POW).toBe(0.625);
    expect(TEXT_CLEARTYPE_FS).toContain('mix(uBgColor.rgb, uColor.rgb');
    expect(TEXT_GRAY_FS).toContain('texture(sDiffuse, textureUV).a');
  });

  it('PR-RENDER-026: eventLabelFont uses shared CSS px size', () => {
    expect(eventLabelFont(12)).toMatch(/^400 12px /);
  });

  it('PR-RENDER-026: clearTypeRasterSupported is false in jsdom', () => {
    expect(clearTypeRasterSupported()).toBe(false);
  });

  it('PR-RENDER-026: fitTextWidth truncates over-wide labels with ellipsis', () => {
    // Monospace measurer: width == char count.
    const mono = { measureText: (s: string) => ({ width: s.length }) };
    expect(fitTextWidth(mono, 'short', 10)).toBe('short');
    const cut = fitTextWidth(mono, 'abcdefghijklmnop', 8);
    expect(cut).toBe('abcde...');
    expect(cut.length).toBeLessThanOrEqual(8);
  });

  it('PR-RENDER-026: fitTextWidth strips a trailing space/underscore before the ellipsis', () => {
    const mono = { measureText: (s: string) => ({ width: s.length }) };
    // Cut lands on a trailing '_' → dropped, ellipsis follows the word.
    expect(fitTextWidth(mono, 'a_bcdef', 5)).toBe('a...');
    // Cut lands on a trailing space → dropped.
    expect(fitTextWidth(mono, 'a bcdef', 5)).toBe('a...');
  });

  it('PR-RENDER-026: fitEventLabel picks draw/shrink/truncate/skip by width ratio', () => {
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

  it('PR-RENDER-026: centeredTextBaseline centers ink and falls back to middle', () => {
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
  /** Minimal OffscreenCanvas stub so TextAtlas can rasterize in jsdom. */
  class FakeCtx {
    font = '';
    textAlign = 'center';
    textBaseline = 'alphabetic';
    fillStyle = '#000000';
    measureText(text: string): { width: number; actualBoundingBoxAscent: number; actualBoundingBoxDescent: number } {
      // Monospace: width == char count; symmetric ink so centeredTextBaseline takes the alphabetic branch.
      return { width: text.length, actualBoundingBoxAscent: 9, actualBoundingBoxDescent: 3 };
    }
    fillRect(): void {}
    fillText(): void {}
    save(): void {}
    translate(): void {}
    scale(): void {}
    restore(): void {}
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
  });

  it('PR-RENDER-027: evicts least-recently-used glyphs beyond the byte budget', () => {
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

  it('PR-RENDER-027: cache hit refreshes recency and clear() deletes all', () => {
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

  it('PR-RENDER-027: caches skip misses so the probe is not re-allocated each frame', () => {
    // A counting OffscreenCanvas reveals how many 2D probe contexts get allocated.
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
    const allocsAfterFirst = allocs; // platform probe + fit probe (2 allocations)
    expect(allocsAfterFirst).toBeGreaterThan(0);

    // The same (static-viewport) key now short-circuits before any OffscreenCanvas probe.
    expect(atlas.get(gl, long, 12, 10)).toBeNull();
    expect(allocs).toBe(allocsAfterFirst);
  });

  it('PR-RENDER-027: rounds maxWidth so sub-pixel pan/zoom deltas reuse the glyph', () => {
    vi.stubGlobal('OffscreenCanvas', FakeCanvas);
    const atlas = new TextAtlas(1600);
    const a = atlas.get(gl, 'aaa', 12, 100.2)!;
    // 100.4 rounds to the same integer bucket as 100.2 → cache hit (same glyph object).
    expect(atlas.get(gl, 'aaa', 12, 100.4)).toBe(a);
    // A width that lands in the next bucket mints a new glyph.
    const c = atlas.get(gl, 'aaa', 12, 101.4)!;
    expect(c).not.toBe(a);
  });
});
