/**
 * ClearType text atlas (Sudu-inspired spike).
 *
 * Rasterizes glyphs white-on-black into an *opaque* 2D canvas (`alpha: false`), which is the
 * only condition under which browsers enable subpixel/ClearType antialiasing. The resulting
 * RGB channels encode per-subpixel coverage (not a scalar alpha); a fragment shader re-colorizes
 * them against any background (`TEXT_CLEARTYPE_FS` in `./shaders.ts`).
 */

export interface TextGlyph {
  texture: WebGLTexture;
  width: number;
  height: number;
  /** Horizontal shrink from `fitEventLabel`; 1 when already baked into the bitmap. */
  scaleX: number;
}

const FONT_FAMILY = 'ui-sans-serif, system-ui, sans-serif';

/** CSS px before DPR scale — shared by WebGL ClearType and Canvas overlay labels. */
export const EVENT_LABEL_FONT_CSS_PX = 12;

export function eventLabelFont(sizePx: number): string {
  // Regular weight (400): ClearType `pow(rgb, 2.25)` on white-on-black narrows the antialiased
  // edge, but at 12px the regular stroke stays legible. Matches the live Canvas2D overlay
  // (`drawEventLabel`), which uses the same weight.
  return `400 ${Math.max(8, Math.round(sizePx))}px ${FONT_FAMILY}`;
}

/** Minimal `measureText` surface — satisfied by Canvas2D and OffscreenCanvas2D contexts alike. */
export interface TextMeasurer {
  measureText(text: string): { width: number };
}

/** How an event label should be rendered to fit its available width (never shrunk vertically). */
export type LabelFit =
  | { kind: 'draw'; text: string }
  | { kind: 'shrink'; text: string; scaleX: number }
  | { kind: 'truncate'; text: string }
  | { kind: 'skip' };

/** Ink bounds returned by `measureText` on real 2D contexts (absent in jsdom stubs). */
export interface TextMetricsLike {
  width: number;
  actualBoundingBoxAscent?: number;
  actualBoundingBoxDescent?: number;
}

/**
 * Vertical placement that centers a label's ink, not its em-box. `textBaseline='middle'` centers
 * the em square, leaving text visibly high/low for fonts with asymmetric ascent/descent
 * (system-ui). When ink bounds are available, return an `alphabetic` baseline shifted by
 * `ascent / 2` so the above-baseline ink centers on `centerY`; otherwise fall back to `middle`.
 *
 * The descent is clamped to 0: per-glyph ink below the baseline (an underscore, `g`, `y`)
 * inflates `actualBoundingBoxDescent`, which would shift the whole body up and put labels with
 * an underscore on a different baseline than labels without. Ignoring it keeps every label's
 * letter body on the same line.
 */
export function centeredTextBaseline(
  metrics: TextMetricsLike,
  centerY: number,
): { baselineY: number; baseline: 'middle' | 'alphabetic' } {
  const ascent = metrics.actualBoundingBoxAscent ?? 0;
  if (ascent > 0) {
    return { baselineY: centerY + ascent / 2, baseline: 'alphabetic' };
  }
  return { baselineY: centerY, baseline: 'middle' };
}

/**
 * Truncate `text` with a trailing `...` so it measures within `maxWidth`; returns the original
 * text when it already fits. Binary-searches the longest fitting prefix (log n measurements).
 * Replaces the canvas `fillText(text, …, maxWidth)` condense behavior, which horizontally
 * squeezed over-wide labels instead of cutting them off.
 */
export function fitTextWidth(measurer: TextMeasurer, text: string, maxWidth: number): string {
  if (measurer.measureText(text).width <= maxWidth) return text;
  const ellipsis = '...';
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measurer.measureText(text.slice(0, mid) + ellipsis).width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  // The cut text must not end with a space or '_' — drop trailing separators before the
  // ellipsis (plain index walk, no regex) so the label never reads like `foo_…` / `foo …`.
  let end = lo;
  while (end > 0) {
    const ch = text[end - 1];
    if (ch !== ' ' && ch !== '_') break;
    end--;
  }
  return text.slice(0, end) + ellipsis;
}

/**
 * Decide how to render `text` into `maxWidth` (the visible event rect's available width), never
 * shrinking vertically:
 *   fits            → draw as-is
 *   rect ≥ 80% wide → horizontal shrink (`scaleX = maxWidth / measured`)
 *   30–80%          → truncate with a trailing `...`
 *   < 30%           → skip (too narrow to read)
 */
export function fitEventLabel(measurer: TextMeasurer, text: string, maxWidth: number): LabelFit {
  const measured = measurer.measureText(text).width;
  if (measured <= maxWidth) return { kind: 'draw', text };
  const ratio = maxWidth / measured;
  if (ratio >= 0.8) return { kind: 'shrink', text, scaleX: ratio };
  if (ratio >= 0.3) return { kind: 'truncate', text: fitTextWidth(measurer, text, maxWidth) };
  return { kind: 'skip' };
}

/** True when OffscreenCanvas + opaque 2D context are available (browser only). */
export function clearTypeRasterSupported(): boolean {
  if (typeof OffscreenCanvas === 'undefined') return false;
  const probe = new OffscreenCanvas(16, 16);
  return Boolean(probe.getContext('2d', { alpha: false }));
}

/** Upper bound on cached label texture memory (RGBA bytes); least-recently-used glyphs are evicted beyond it. */
export const DEFAULT_MAX_GLYPH_BYTES = 16 * 1024 * 1024; // 16 MiB

/** Upper bound on cached `measureText` widths (full strings + truncation prefixes). */
export const DEFAULT_MAX_MEASURES = 16384;

/** 2D surface used to measure and rasterize — real OffscreenCanvas2D or the unit-test stub. */
interface Atlas2d {
  font: string;
  fillStyle: string;
  textAlign: string;
  textBaseline: CanvasTextBaseline | string;
  measureText(text: string): TextMetricsLike;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  scale(x: number, y: number): void;
}

export class TextAtlas {
  private glyphs = new Map<string, TextGlyph>();
  private measures = new Map<string, number>();
  private bytes = 0;
  private probeCtx: Atlas2d | null | undefined;
  private probeFontPx = 0;
  private rasterCanvas: OffscreenCanvas | null = null;
  private rasterCtx: Atlas2d | null = null;

  constructor(
    private readonly maxBytes = DEFAULT_MAX_GLYPH_BYTES,
    private readonly maxMeasures = DEFAULT_MAX_MEASURES,
  ) {}

  static isSupported(): boolean {
    return clearTypeRasterSupported();
  }

  /**
   * Rasterize + upload `text`. Draw/truncate cache by `(sizePx, drawn text)` so clip-width
   * pan reuses the texture. Shrink bakes `scaleX` into a 1:1 ClearType glyph (keyed with
   * integer `maxWidth`) — GPU-scaling a full-size texture shears subpixel RGB and clips
   * the first letter at the event edge. Returns null when the platform lacks
   * `OffscreenCanvas` or the label is too narrow to draw.
   */
  get(
    gl: WebGL2RenderingContext,
    text: string,
    fontSizePx: number,
    maxWidth: number,
    pad = 2,
  ): TextGlyph | null {
    // Bucket clip width to integer device px before fitting. `eventLabelAnchor` supplies a
    // continuous float (`visibleW - 8`); rounding keeps the draw/shrink/truncate/skip choice
    // stable across sub-pixel pan/zoom. The glyph key itself does not include this width.
    const widthPx = Math.round(maxWidth);
    const probe = this.ensureProbe(fontSizePx);
    if (!probe) return null;

    const fit = fitEventLabel(
      { measureText: (s) => ({ width: this.measureWidth(probe, fontSizePx, s) }) },
      text,
      widthPx,
    );
    if (fit.kind === 'skip') return null;

    const scaleX = fit.kind === 'shrink' ? fit.scaleX : 1;
    const drawn = fit.text;
    // Draw/truncate share one glyph per string. Shrink must not: a 0.8-baked texture
    // drawn 1:1 at a wider clip would clip letters, and GPU-scaling a 1.0 texture
    // breaks ClearType (NEAREST minify) the same way.
    const key = scaleX === 1 ? `${fontSizePx}\0${drawn}` : `${fontSizePx}\0${drawn}\0${widthPx}`;
    const cached = this.glyphs.get(key);
    if (cached) {
      this.glyphs.delete(key);
      this.glyphs.set(key, cached);
      return cached;
    }

    const raster = this.rasterize(drawn, fontSizePx, pad, scaleX);
    if (!raster) return null;

    const texture = gl.createTexture();
    if (!texture) return null;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // Preserve the raw subpixel RGB — do not premultiply or colorspace-convert the fringe.
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, raster.canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // Glyph quads draw 1:1 (including baked shrink), so NEAREST keeps the subpixel RGB fringe.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);

    const glyph: TextGlyph = { texture, width: raster.w, height: raster.h, scaleX: 1 };
    this.glyphs.set(key, glyph);
    this.bytes += raster.w * raster.h * 4;
    this.evictOverBudget(gl);
    return glyph;
  }

  private ensureProbe(fontSizePx: number): Atlas2d | null {
    if (this.probeCtx === undefined) {
      const opened = this.open2d(16, 16);
      this.probeCtx = opened?.ctx ?? null;
    }
    if (!this.probeCtx) return null;
    if (this.probeFontPx !== fontSizePx) {
      this.probeCtx.font = eventLabelFont(fontSizePx);
      this.probeFontPx = fontSizePx;
    }
    return this.probeCtx;
  }

  private open2d(w: number, h: number): { canvas: OffscreenCanvas; ctx: Atlas2d } | null {
    if (typeof OffscreenCanvas === 'undefined') return null;
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d', { alpha: false }) as Atlas2d | null;
    if (!ctx) return null;
    return { canvas, ctx };
  }

  private measureWidth(ctx: Atlas2d, fontSizePx: number, text: string): number {
    const key = `${fontSizePx}\0${text}`;
    const hit = this.measures.get(key);
    if (hit !== undefined) {
      this.measures.delete(key);
      this.measures.set(key, hit);
      return hit;
    }
    ctx.font = eventLabelFont(fontSizePx);
    this.probeFontPx = fontSizePx;
    const width = ctx.measureText(text).width;
    this.measures.set(key, width);
    while (this.measures.size > this.maxMeasures) {
      const oldest = this.measures.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.measures.delete(oldest);
    }
    return width;
  }

  private rasterize(
    drawn: string,
    fontSizePx: number,
    pad: number,
    scaleX: number,
  ): { canvas: OffscreenCanvas; w: number; h: number } | null {
    const probe = this.probeCtx;
    if (!probe) return null;
    const inkW = Math.max(1, Math.ceil(this.measureWidth(probe, fontSizePx, drawn) * scaleX));
    const w = inkW + pad * 2;
    const h = Math.ceil(fontSizePx * 1.5);

    if (!this.rasterCanvas || !this.rasterCtx) {
      const opened = this.open2d(w, h);
      if (!opened) return null;
      this.rasterCanvas = opened.canvas;
      this.rasterCtx = opened.ctx;
    } else if (this.rasterCanvas.width !== w || this.rasterCanvas.height !== h) {
      this.rasterCanvas.width = w;
      this.rasterCanvas.height = h;
    }

    const ctx = this.rasterCtx;
    const canvas = this.rasterCanvas;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.font = eventLabelFont(fontSizePx);
    ctx.textAlign = 'center';
    const m = ctx.measureText(drawn);
    const { baselineY, baseline } = centeredTextBaseline(m, h / 2);
    ctx.textBaseline = baseline;
    // Horizontal-only shrink around the glyph center; bake into the bitmap so the quad
    // stays 1:1 with NEAREST (GPU-scaling a ClearType texture clips/shears the first letter).
    ctx.save();
    ctx.translate(w / 2, baselineY);
    ctx.scale(scaleX, 1);
    ctx.fillText(drawn, 0, 0);
    ctx.restore();
    return { canvas, w, h };
  }

  /** Evict least-recently-used glyphs until the byte budget is met. */
  private evictOverBudget(gl: WebGL2RenderingContext): void {
    while (this.bytes > this.maxBytes && this.glyphs.size > 0) {
      const oldestKey = this.glyphs.keys().next().value as string | undefined;
      if (oldestKey === undefined) break;
      const glyph = this.glyphs.get(oldestKey);
      this.glyphs.delete(oldestKey);
      if (glyph) {
        this.bytes -= glyph.width * glyph.height * 4;
        gl.deleteTexture(glyph.texture);
      }
    }
  }

  /** Delete every cached texture and reset the budget (dpr/font change invalidates every label). */
  clear(gl: WebGL2RenderingContext): void {
    for (const g of this.glyphs.values()) gl.deleteTexture(g.texture);
    this.glyphs.clear();
    this.measures.clear();
    this.bytes = 0;
  }

  dispose(gl: WebGL2RenderingContext): void {
    this.clear(gl);
  }
}
