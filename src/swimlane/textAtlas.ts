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
 * (ascent − descent)/2 so the ink midpoint lands on `centerY`; otherwise fall back to `middle`.
 */
export function centeredTextBaseline(
  metrics: TextMetricsLike,
  centerY: number,
): { baselineY: number; baseline: 'middle' | 'alphabetic' } {
  const ascent = metrics.actualBoundingBoxAscent ?? 0;
  const descent = metrics.actualBoundingBoxDescent ?? 0;
  if (ascent > 0 || descent > 0) {
    return { baselineY: centerY + (ascent - descent) / 2, baseline: 'alphabetic' };
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

export class TextAtlas {
  private glyphs = new Map<string, TextGlyph>();

  static isSupported(): boolean {
    return clearTypeRasterSupported();
  }

  /**
   * Rasterize + upload `text`, cached by `(sizePx, maxWidth, text)`. Returns null when the
   * platform lacks `OffscreenCanvas` (jsdom, older browsers) — callers must fall back to the
   * grayscale Canvas2D overlay.
   */
  get(
    gl: WebGL2RenderingContext,
    text: string,
    fontSizePx: number,
    maxWidth: number,
    pad = 2,
  ): TextGlyph | null {
    const key = `${fontSizePx}|${maxWidth}|${text}`;
    const cached = this.glyphs.get(key);
    if (cached) return cached;
    if (!clearTypeRasterSupported()) return null;

    const probe = new OffscreenCanvas(16, 16);
    const probeCtx = probe.getContext('2d', { alpha: false })!;
    probeCtx.font = eventLabelFont(fontSizePx);
    // Fit policy: draw as-is / horizontal-shrink / truncate / skip (see `fitEventLabel`).
    const fit = fitEventLabel(probeCtx, text, maxWidth);
    if (fit.kind === 'skip') return null;
    const scaleX = fit.kind === 'shrink' ? fit.scaleX : 1;
    const measured = Math.ceil(probeCtx.measureText(fit.text).width * scaleX);
    const drawW = Math.max(1, measured);
    const w = drawW + pad * 2;
    const h = Math.ceil(fontSizePx * 1.5);

    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return null;
    ctx.fillStyle = '#000000'; // opaque black base (alpha:false starts black; explicit for intent)
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff'; // white ink → subpixel RGB coverage
    ctx.font = eventLabelFont(fontSizePx);
    ctx.textAlign = 'center';
    const m = ctx.measureText(fit.text);
    const { baselineY, baseline } = centeredTextBaseline(m, h / 2);
    ctx.textBaseline = baseline;
    // Horizontal-only shrink: scale around the glyph's own center so the ink stays centered
    // and the vertical metrics are untouched.
    ctx.save();
    ctx.translate(w / 2, baselineY);
    ctx.scale(scaleX, 1);
    ctx.fillText(fit.text, 0, 0);
    ctx.restore();

    const texture = gl.createTexture();
    if (!texture) return null;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // Preserve the raw subpixel RGB — do not premultiply or colorspace-convert the fringe.
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // Glyph quads are drawn 1:1 (texture size == device-px quad size), so NEAREST keeps the
    // subpixel RGB fringe intact. LINEAR would re-blur the half-texel sampling. If glyphs are
    // ever drawn at a different scale, switch these back to LINEAR.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);

    const glyph = { texture, width: w, height: h };
    this.glyphs.set(key, glyph);
    return glyph;
  }

  dispose(gl: WebGL2RenderingContext): void {
    for (const g of this.glyphs.values()) gl.deleteTexture(g.texture);
    this.glyphs.clear();
  }
}
