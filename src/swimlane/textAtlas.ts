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
export const EVENT_LABEL_FONT_CSS_PX = 10;

export function eventLabelFont(sizePx: number): string {
  // Bold weight (700): ClearType `pow(rgb, 2.25)` on white-on-black narrows the antialiased
  // edge, so a heavier stroke keeps labels legible at the 10px device size. Matches the live
  // Canvas2D overlay (`drawEventLabel`), which uses the same weight.
  return `700 ${Math.max(8, Math.round(sizePx))}px ${FONT_FAMILY}`;
}

/** Minimal `measureText` surface — satisfied by Canvas2D and OffscreenCanvas2D contexts alike. */
interface TextMeasurer {
  measureText(text: string): { width: number };
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
  return text.slice(0, lo) + ellipsis;
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
    // Truncate with an ellipsis; the canvas no longer re-condenses over-wide text.
    const label = fitTextWidth(probeCtx, text, maxWidth);
    const measured = Math.ceil(probeCtx.measureText(label).width);
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
    ctx.textBaseline = 'middle';
    ctx.fillText(label, w / 2, h / 2);

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
